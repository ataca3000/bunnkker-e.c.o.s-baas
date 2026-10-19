<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Hr\Compensation\Domain\Enums\CommissionMethod;
use Modules\Hr\Compensation\Domain\Enums\CommissionScope;
use Modules\Hr\Compensation\Domain\Enums\KpiMetric;
use Modules\Hr\Compensation\Domain\Exceptions\CompensationException;
use Modules\Hr\Compensation\Domain\Models\CommissionRule;
use Modules\Hr\Compensation\Domain\Models\CommissionRuleTier;

/**
 * Administering commission rules.
 *
 * ┌─ CHANGING A RATE IS A NEW VERSION, NOT AN EDIT ─────────────────────────┐
 * │ The engine already resolved rules as of the period start, so history was    │
 * │ READ correctly. What could still rewrite it was editing a rule in place:    │
 * │ change 2% to 3% and last March silently recalculates at the new rate,       │
 * │ because the row March was paid from no longer exists.                      │
 * │                                                                            │
 * │ So the economic fields — metric, method, rate, scope, tiers, limits — are   │
 * │ refused by update(). Changing them goes through newVersion(), which closes  │
 * │ the current version the day before the new one starts and appends a         │
 * │ successor. March keeps finding the row it was paid from, because that row   │
 * │ is still there and still says 2%.                                          │
 * │                                                                            │
 * │ Names, descriptions and priority stay editable in place. Fixing a typo in   │
 * │ a rule's name moves nobody's money.                                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * A version cannot start inside a period whose payroll has been approved, which
 * is the same principle as Part 7 applied to rules rather than to amounts.
 */
final class CommissionRuleService
{
    /** Editable in place: none of these change what anyone is paid. */
    private const DESCRIPTIVE_FIELDS = ['name', 'description', 'priority', 'is_active'];

    public function __construct(private readonly CompensationLockService $lock) {}

    public function create(string $companyId, array $data): CommissionRule
    {
        $metric = KpiMetric::tryFrom((string) ($data['metric_key'] ?? ''));

        if ($metric === null) {
            throw CompensationException::unknownMetric((string) ($data['metric_key'] ?? ''));
        }

        $method = ($data['method'] ?? null) instanceof CommissionMethod
            ? $data['method']
            : (CommissionMethod::tryFrom((string) ($data['method'] ?? '')) ?? CommissionMethod::PercentageOfValue);

        $tiers = (array) ($data['tiers'] ?? []);

        if ($method->requiresTiers() && $tiers === []) {
            throw CompensationException::tiersRequired();
        }

        $scope = ($data['applies_to'] ?? null) instanceof CommissionScope
            ? $data['applies_to']
            : (CommissionScope::tryFrom((string) ($data['applies_to'] ?? '')) ?? CommissionScope::All);

        return DB::transaction(function () use ($companyId, $data, $metric, $method, $scope, $tiers): CommissionRule {
            $rule = CommissionRule::create([
                'company_id' => $companyId,
                'code' => $data['code'],
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'metric_key' => $metric->value,
                'method' => $method->value,
                'rate' => round((float) ($data['rate'] ?? 0), 4),
                'applies_to' => $scope->value,
                'target_id' => $data['target_id'] ?? null,
                'dimension_key' => $data['dimension_key'] ?? null,
                'dimension_value' => $data['dimension_value'] ?? null,
                'min_amount' => $data['min_amount'] ?? null,
                'max_amount' => $data['max_amount'] ?? null,
                'threshold_value' => $data['threshold_value'] ?? null,
                'effective_from' => $data['effective_from'] ?? null,
                'effective_to' => $data['effective_to'] ?? null,
                'priority' => (int) ($data['priority'] ?? 100),
                'is_active' => $data['is_active'] ?? true,
                'version' => 1,
            ]);

            // A new rule is version 1 of its own lineage.
            $rule->update(['version_group' => $rule->id]);

            $this->replaceTiers($rule, $tiers);

            return $rule->refresh();
        });
    }

    /**
     * Edit the descriptive fields of a rule.
     *
     * Economic changes are refused here and pointed at newVersion(), because
     * accepting them silently would be exactly the behaviour Part 8 exists to
     * prevent.
     */
    public function update(CommissionRule $rule, array $data): CommissionRule
    {
        $economic = array_intersect(array_keys($data), CommissionRule::ECONOMIC_FIELDS);

        if ($economic !== []) {
            throw CompensationException::ruleEconomicsAreVersioned();
        }

        return DB::transaction(function () use ($rule, $data): CommissionRule {
            $rule->update(array_intersect_key($data, array_flip(self::DESCRIPTIVE_FIELDS)));

            return $rule->refresh();
        });
    }

    /**
     * Supersede a rule with a new version.
     *
     * The current version is closed the day BEFORE the new one starts, so the two
     * never overlap and a payroll date always resolves to exactly one of them.
     *
     * @param  array<string, mixed>  $changes  the economic fields that differ
     */
    public function newVersion(CommissionRule $rule, array $changes, string $effectiveFrom): CommissionRule
    {
        if (trim($effectiveFrom) === '') {
            throw CompensationException::versionEffectiveDateRequired();
        }

        $start = Carbon::parse($effectiveFrom)->startOfDay();
        $companyId = (string) $rule->company_id;

        // Backdating into approved payroll would recalculate pay Finance has been
        // told about. The same line Part 7 draws, drawn around rules.
        $locking = $this->lock->lockingPeriod($companyId, $start->toDateString());

        if ($locking !== null) {
            throw CompensationException::versionOverlapsHistory(
                $start->toDateString(),
                (string) $locking->code,
            );
        }

        $current = $this->latestVersionOf($rule);

        $metric = isset($changes['metric_key'])
            ? KpiMetric::tryFrom((string) $changes['metric_key'])
            : KpiMetric::tryFrom((string) $current->metric_key);

        if ($metric === null) {
            throw CompensationException::unknownMetric((string) ($changes['metric_key'] ?? $current->metric_key));
        }

        $method = isset($changes['method'])
            ? (($changes['method'] instanceof CommissionMethod)
                ? $changes['method']
                : CommissionMethod::tryFrom((string) $changes['method']) ?? $current->method)
            : $current->method;

        // Unspecified tiers carry forward from the version being replaced, so a
        // revision that only moves a threshold does not silently drop the bands.
        $tiers = array_key_exists('tiers', $changes)
            ? (array) $changes['tiers']
            : $current->tiers->map(fn (CommissionRuleTier $t) => [
                'from_value' => (float) $t->from_value,
                'to_value' => $t->to_value === null ? null : (float) $t->to_value,
                'rate' => (float) $t->rate,
                'sequence' => (int) $t->sequence,
            ])->all();

        if ($method->requiresTiers() && $tiers === []) {
            throw CompensationException::tiersRequired();
        }

        $scope = isset($changes['applies_to'])
            ? (($changes['applies_to'] instanceof CommissionScope)
                ? $changes['applies_to']
                : CommissionScope::tryFrom((string) $changes['applies_to']) ?? $current->applies_to)
            : $current->applies_to;

        return DB::transaction(function () use ($current, $changes, $start, $metric, $method, $scope, $tiers, $companyId): CommissionRule {
            $successor = CommissionRule::create([
                'company_id' => $companyId,
                'code' => $current->code,
                'name' => $changes['name'] ?? $current->name,
                'description' => $changes['description'] ?? $current->description,
                'metric_key' => $metric->value,
                'method' => $method->value,
                'rate' => round((float) ($changes['rate'] ?? $current->rate), 4),
                'applies_to' => $scope->value,
                'target_id' => $changes['target_id'] ?? $current->target_id,
                'dimension_key' => $changes['dimension_key'] ?? $current->dimension_key,
                'dimension_value' => $changes['dimension_value'] ?? $current->dimension_value,
                'min_amount' => $changes['min_amount'] ?? $current->min_amount,
                'max_amount' => $changes['max_amount'] ?? $current->max_amount,
                'threshold_value' => $changes['threshold_value'] ?? $current->threshold_value,
                'effective_from' => $start->toDateString(),
                'effective_to' => $changes['effective_to'] ?? null,
                'priority' => (int) ($changes['priority'] ?? $current->priority),
                'is_active' => true,
                'version' => (int) $current->version + 1,
                'version_group' => $current->version_group ?? $current->id,
                'supersedes_rule_id' => $current->id,
            ]);

            $this->replaceTiers($successor, $tiers);

            // Close the outgoing version the day before, never on the same day —
            // two rules live on one date would both pay.
            $current->update([
                'effective_to' => $start->copy()->subDay()->toDateString(),
                'superseded_at' => Carbon::now(),
            ]);

            return $successor->refresh();
        });
    }

    /**
     * The whole history of a rule — what it paid, and when it changed.
     *
     * @return array<string, mixed>
     */
    public function versionHistory(CommissionRule $rule): array
    {
        $group = $rule->version_group ?? $rule->id;

        $versions = CommissionRule::query()
            ->with('tiers')
            ->where('company_id', $rule->company_id)
            ->where('version_group', $group)
            ->orderBy('version')
            ->get();

        return [
            'code' => $rule->code,
            'version_group' => (string) $group,
            'current_version' => (int) ($versions->last()->version ?? 1),
            'versions' => $versions->map(fn (CommissionRule $v) => [
                'id' => (string) $v->id,
                'version' => (int) $v->version,
                'metric_key' => $v->metric_key,
                'method' => $v->method->value,
                'rate' => (float) $v->rate,
                'applies_to' => $v->applies_to->value,
                'target_id' => $v->target_id,
                'threshold_value' => $v->threshold_value === null ? null : (float) $v->threshold_value,
                'min_amount' => $v->min_amount === null ? null : (float) $v->min_amount,
                'max_amount' => $v->max_amount === null ? null : (float) $v->max_amount,
                'tiers' => $v->tiers->map(fn (CommissionRuleTier $t) => [
                    'from_value' => (float) $t->from_value,
                    'to_value' => $t->to_value === null ? null : (float) $t->to_value,
                    'rate' => (float) $t->rate,
                    'sequence' => (int) $t->sequence,
                ])->all(),
                'effective_from' => $v->effective_from?->toDateString(),
                'effective_to' => $v->effective_to?->toDateString(),
                'is_current' => ! $v->isSuperseded(),
                'superseded_at' => $v->superseded_at?->toDateTimeString(),
                'supersedes_rule_id' => $v->supersedes_rule_id === null ? null : (string) $v->supersedes_rule_id,
            ])->all(),
        ];
    }

    /**
     * Which version of a rule was in force on a date — the question a commission
     * dispute actually asks.
     */
    public function versionInForceOn(CommissionRule $rule, string $date): ?CommissionRule
    {
        $group = $rule->version_group ?? $rule->id;

        return CommissionRule::query()
            ->with('tiers')
            ->where('company_id', $rule->company_id)
            ->where('version_group', $group)
            ->effectiveOn(Carbon::parse($date)->toDateString())
            ->orderByDesc('version')
            ->first();
    }

    /**
     * The current version of every rule — what the administration screen lists.
     *
     * Superseded versions are excluded: they are history, and showing eleven
     * versions of one scheme in a settings list is how the wrong one gets edited.
     *
     * @return \Illuminate\Database\Eloquent\Collection<int, CommissionRule>
     */
    public function forCompany(string $companyId)
    {
        return CommissionRule::query()
            ->with('tiers')
            ->where('company_id', $companyId)
            ->whereNull('superseded_at')
            ->orderBy('name')
            ->get();
    }

    /**
     * The metric catalogue a rule can be written against — what the UI offers.
     *
     * @return array<int, array<string, mixed>>
     */
    public function availableMetrics(): array
    {
        return array_map(fn (KpiMetric $m) => [
            'key' => $m->value,
            'label' => $m->label(),
            'module' => $m->sourceModule(),
            'unit' => $m->unit(),
            'aggregation' => $m->aggregation()->value,
            'higher_is_better' => $m->higherIsBetter(),
        ], KpiMetric::cases());
    }

    private function latestVersionOf(CommissionRule $rule): CommissionRule
    {
        $group = $rule->version_group ?? $rule->id;

        $latest = CommissionRule::query()
            ->with('tiers')
            ->where('company_id', $rule->company_id)
            ->where('version_group', $group)
            ->orderByDesc('version')
            ->first();

        return $latest ?? $rule;
    }

    /** @param array<int, array<string, mixed>> $tiers */
    private function replaceTiers(CommissionRule $rule, array $tiers): void
    {
        $rule->tiers()->delete();

        $sequence = 1;
        foreach ($tiers as $tier) {
            CommissionRuleTier::create([
                'rule_id' => $rule->id,
                'from_value' => round((float) ($tier['from_value'] ?? 0), 4),
                'to_value' => isset($tier['to_value']) && $tier['to_value'] !== null
                    ? round((float) $tier['to_value'], 4)
                    : null,
                'rate' => round((float) ($tier['rate'] ?? 0), 4),
                'sequence' => (int) ($tier['sequence'] ?? $sequence),
            ]);
            $sequence++;
        }
    }
}
