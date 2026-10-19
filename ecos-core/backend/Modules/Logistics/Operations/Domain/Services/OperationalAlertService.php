<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Logistics\Operations\Domain\Enums\ExceptionStatus;
use Modules\Logistics\Operations\Domain\Models\AlertRule;
use Modules\Logistics\Operations\Domain\Models\OperationalException;

/**
 * Which exceptions are shouting right now.
 *
 * ┌─ AN ALERT IS AN EXCEPTION A RULE MATCHED ───────────────────────────────┐
 * │ There is no alerts table. Two tables would mean two records of one       │
 * │ problem, drifting apart the moment somebody resolved one of them, and    │
 * │ an operator would have to close the same thing twice.                    │
 * │                                                                          │
 * │ A rule is CONFIGURATION over the registry: which exceptions surface,     │
 * │ how impatiently they escalate, and which are deliberately silenced.      │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Alerts therefore auto-resolve for free: when the underlying exception closes,
 * it stops matching, and the alert is gone. A list that only ever grows is one
 * operators learn to ignore.
 */
class OperationalAlertService
{
    /** @param array<string, mixed> $attributes */
    public function createRule(array $attributes, ?int $actorId = null): AlertRule
    {
        $rule = new AlertRule($attributes);
        $rule->created_by = $actorId;
        $rule->save();

        return $rule->refresh();
    }

    /** @param array<string, mixed> $attributes */
    public function updateRule(AlertRule $rule, array $attributes): AlertRule
    {
        $rule->update($attributes);

        return $rule->refresh();
    }

    /** @return list<AlertRule> */
    public function rules(?string $companyId = null): array
    {
        return AlertRule::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->orderByDesc('is_active')
            ->orderBy('name')
            ->get()
            ->all();
    }

    /**
     * Live alerts — outstanding exceptions that a non-suppressing rule matches.
     *
     * With no rules configured at all, everything critical still surfaces. A
     * fresh installation that silently alerts on nothing is a trap.
     *
     * @return list<array<string, mixed>>
     */
    public function active(?string $companyId = null, ?Carbon $at = null): array
    {
        $at ??= Carbon::now();

        $rules = AlertRule::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->where('is_active', true)
            ->get();

        $exceptions = OperationalException::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->whereIn('status', [
                ExceptionStatus::Open->value,
                ExceptionStatus::Acknowledged->value,
                ExceptionStatus::Escalated->value,
            ])
            ->orderByDesc('last_seen_at')
            ->get();

        $alerts = [];

        foreach ($exceptions as $exception) {
            $matched = $rules->filter(fn (AlertRule $r) => $r->matches($exception));

            // An explicit suppression wins over every other matching rule: it
            // is a decision somebody made on purpose.
            $suppressor = $matched->first(fn (AlertRule $r) => $r->suppress);

            if ($suppressor !== null) {
                continue;
            }

            $rule = $matched->first(fn (AlertRule $r) => ! $r->suppress);

            // No rules configured → fall back to severity, so a fresh install
            // is not silent about critical problems.
            if ($rule === null && ! ($rules->isEmpty() && $exception->severity->rank() >= 3)) {
                continue;
            }

            $alerts[] = [
                'exception_id' => $exception->uuid,
                'rule' => $rule?->name,
                'source' => $exception->source->value,
                'category' => $exception->category->value,
                'severity' => $exception->severity->value,
                'severity_rank' => $exception->severity->rank(),
                'status' => $exception->status->value,
                'title' => $exception->title,
                'occurrence_count' => $exception->occurrence_count,
                'age_minutes' => $exception->ageMinutes($at),
                'unacknowledged_minutes' => $exception->unacknowledgedMinutes($at),
                'escalation_level' => $exception->escalation_level,
                'is_overdue' => $exception->isOverdueForEscalation($at),
            ];
        }

        // Loudest first, then oldest — the order an operator would work them.
        usort($alerts, static function (array $a, array $b) {
            return [$b['severity_rank'], $b['age_minutes']] <=> [$a['severity_rank'], $a['age_minutes']];
        });

        return $alerts;
    }

    /**
     * Headline counts for the alert strip.
     *
     * @return array<string, int>
     */
    public function summary(?string $companyId = null): array
    {
        $alerts = $this->active($companyId);

        return [
            'total' => count($alerts),
            'critical' => count(array_filter($alerts, static fn ($a) => $a['severity'] === 'critical')),
            'warning' => count(array_filter($alerts, static fn ($a) => $a['severity'] === 'warning')),
            'info' => count(array_filter($alerts, static fn ($a) => $a['severity'] === 'info')),
            'unacknowledged' => count(array_filter(
                $alerts,
                static fn ($a) => $a['unacknowledged_minutes'] !== null,
            )),
            'overdue' => count(array_filter($alerts, static fn ($a) => $a['is_overdue'])),
        ];
    }
}
