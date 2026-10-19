<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Hr\Compensation\Domain\Enums\CommissionMethod;
use Modules\Hr\Compensation\Domain\Enums\CommissionScope;
use Modules\Hr\Compensation\Domain\Models\CommissionRule;
use Modules\Hr\Compensation\Domain\Models\CommissionRuleTier;
use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * The commission engine.
 *
 * ┌─ ONE ENGINE · EVERY SCHEME · NO SCHEME IN THE CODE ─────────────────────┐
 * │ A sales representative on a percentage of sales and a driver paid per      │
 * │ delivered shipment run through exactly the same three lines of arithmetic. │
 * │ What differs is the RULE: which metric it measures, which method it        │
 * │ applies, and at what rate. There is no per-role branch anywhere here, so a │
 * │ new commission scheme is configuration, never a deployment.                │
 * │                                                                            │
 * │ Every figure is measured from the KPI facts the operational modules pushed │
 * │ in, and each result carries the inputs that produced it — so "why is my    │
 * │ commission this number" is answered from the payslip.                      │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class CommissionEngine
{
    public function __construct(private readonly KpiFactService $facts) {}

    /**
     * Every commission an employee earned in a window, one entry per matching rule.
     *
     * @return array<int, array<string, mixed>>
     */
    public function calculate(Employee $employee, string $from, string $to): array
    {
        $results = [];

        foreach ($this->rulesFor($employee, $from) as $rule) {
            $earned = $this->applyRule($rule, $employee, $from, $to);

            if ($earned !== null) {
                $results[] = $earned;
            }
        }

        return $results;
    }

    public function total(Employee $employee, string $from, string $to): float
    {
        return round(array_sum(array_column($this->calculate($employee, $from, $to), 'amount')), 2);
    }

    /**
     * The rules that apply to one employee, most specific first.
     *
     * Several rules may apply at once — a company-wide scheme and a personal one —
     * and they all pay. Specificity only decides the order they are reported in.
     *
     * @return array<int, CommissionRule>
     */
    public function rulesFor(Employee $employee, string $onDate): array
    {
        $date = Carbon::parse($onDate);

        $rules = CommissionRule::query()
            ->with('tiers')
            ->where('company_id', $employee->company_id)
            ->effectiveOn($date->toDateString())
            ->get()
            ->filter(fn (CommissionRule $rule) => $this->applies($rule, $employee))
            ->values()
            ->all();

        usort($rules, function (CommissionRule $a, CommissionRule $b): int {
            $scope = $b->applies_to->specificity() <=> $a->applies_to->specificity();

            return $scope !== 0 ? $scope : ($a->priority <=> $b->priority);
        });

        return $rules;
    }

    /** Does this rule cover this employee? */
    public function applies(CommissionRule $rule, Employee $employee): bool
    {
        $scope = $rule->applies_to;

        if ($scope === CommissionScope::All) {
            return true;
        }

        $column = $scope->employeeColumn();

        if ($column === null || $rule->target_id === null) {
            return false;
        }

        return (string) $employee->{$column} === (string) $rule->target_id;
    }

    /**
     * Apply one rule. Returns null when the metric produced nothing to pay on, so
     * an empty month leaves no phantom zero line on the payslip.
     *
     * @return array<string, mixed>|null
     */
    public function applyRule(CommissionRule $rule, Employee $employee, string $from, string $to): ?array
    {
        $measured = $this->facts->aggregate(
            (string) $employee->company_id,
            'employee_id',
            (string) $employee->id,
            (string) $rule->metric_key,
            $from,
            $to,
            $rule->dimension_key,
            $rule->dimension_value,
        );

        if ($measured['facts'] === 0) {
            return null;
        }

        // The method decides which side of the fact is the base.
        $base = $rule->method->reads() === 'quantity' ? $measured['quantity'] : $measured['value'];

        // A rule may require a floor before it pays anything at all.
        $threshold = $rule->threshold_value === null ? null : (float) $rule->threshold_value;
        if ($threshold !== null && $base < $threshold) {
            return $this->result($rule, $measured, $base, 0.0, 0.0, 'below threshold');
        }

        [$amount, $appliedRate, $note] = $this->compute($rule, $base);

        // Guard rails, applied after the method.
        $capped = $amount;
        if ($rule->min_amount !== null && $capped < (float) $rule->min_amount) {
            $capped = (float) $rule->min_amount;
            $note = 'raised to minimum';
        }
        if ($rule->max_amount !== null && $capped > (float) $rule->max_amount) {
            $capped = (float) $rule->max_amount;
            $note = 'capped at maximum';
        }

        return $this->result($rule, $measured, $base, $appliedRate, round($capped, 2), $note);
    }

    /**
     * The arithmetic — three methods, and nothing role-specific.
     *
     * @return array{0: float, 1: float, 2: string|null}
     */
    private function compute(CommissionRule $rule, float $base): array
    {
        return match ($rule->method) {
            CommissionMethod::PercentageOfValue => [
                $base * ((float) $rule->rate / 100),
                (float) $rule->rate,
                null,
            ],
            CommissionMethod::AmountPerUnit => [
                $base * (float) $rule->rate,
                (float) $rule->rate,
                null,
            ],
            CommissionMethod::Tiered => $this->computeTiered($rule, $base),
        };
    }

    /** @return array{0: float, 1: float, 2: string|null} */
    private function computeTiered(CommissionRule $rule, float $base): array
    {
        $tier = $rule->tiers->first(fn (CommissionRuleTier $t) => $t->covers($base));

        if ($tier === null) {
            return [0.0, 0.0, 'no tier matched'];
        }

        // A tier's rate is a percentage of the achieved value, like the flat
        // percentage method — the tiers only decide which percentage applies.
        return [$base * ((float) $tier->rate / 100), (float) $tier->rate, 'tier '.$tier->sequence];
    }

    /**
     * @param  array{value: float, quantity: float, facts: int}  $measured
     * @return array<string, mixed>
     */
    private function result(CommissionRule $rule, array $measured, float $base, float $rate, float $amount, ?string $note): array
    {
        return [
            'rule_id' => (string) $rule->id,
            'rule_code' => $rule->code,
            'rule_name' => $rule->name,
            'metric_key' => $rule->metric_key,
            'method' => $rule->method->value,
            'amount' => $amount,
            'explanation' => [
                'metric' => $rule->metric_key,
                'method' => $rule->method->value,
                'reads' => $rule->method->reads(),
                'measured_value' => $measured['value'],
                'measured_quantity' => $measured['quantity'],
                'facts_counted' => $measured['facts'],
                'base' => round($base, 4),
                'rate' => $rate,
                'formula' => $this->formula($rule),
                'threshold' => $rule->threshold_value === null ? null : (float) $rule->threshold_value,
                'min_amount' => $rule->min_amount === null ? null : (float) $rule->min_amount,
                'max_amount' => $rule->max_amount === null ? null : (float) $rule->max_amount,
                'amount' => $amount,
                'note' => $note,
            ],
        ];
    }

    private function formula(CommissionRule $rule): string
    {
        return match ($rule->method) {
            CommissionMethod::PercentageOfValue => 'amount = measured value × rate%',
            CommissionMethod::AmountPerUnit => 'amount = measured quantity × rate',
            CommissionMethod::Tiered => 'amount = measured value × the matching tier rate%',
        };
    }
}
