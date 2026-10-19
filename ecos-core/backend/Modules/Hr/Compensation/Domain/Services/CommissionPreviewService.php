<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Services;

use Modules\Hr\Compensation\Domain\Enums\KpiMetric;
use Modules\Hr\Compensation\Domain\Models\CommissionRule;
use Modules\Hr\Compensation\Domain\Models\PayrollPeriod;
use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * What commission WOULD be paid, shown before anyone approves it.
 *
 * ┌─ EMPLOYEE → METRIC → RULE → CALCULATION → COMMISSION ───────────────────┐
 * │ Read-only. It writes nothing, changes nothing, and can be run as often as   │
 * │ anyone likes. It runs the SAME engine payroll runs, so the preview and the   │
 * │ payslip cannot disagree — a preview computed a second way would eventually   │
 * │ reassure somebody about a number that then came out different.               │
 * │                                                                            │
 * │ Every line carries the version of the rule that produced it, because a       │
 * │ preview run today for last month must show last month's rate (Part 8).      │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class CommissionPreviewService
{
    public function __construct(
        private readonly CommissionEngine $engine,
        private readonly KpiFactService $facts,
    ) {}

    /**
     * The whole period, every employee who earned anything.
     *
     * @return array<string, mixed>
     */
    public function forPeriod(PayrollPeriod $period, ?string $employeeId = null): array
    {
        $from = (string) $period->start_date?->toDateString();
        $to = (string) $period->end_date?->toDateString();

        $query = Employee::query()
            ->where('company_id', $period->company_id)
            ->whereNotIn('status', ['terminated', 'resigned'])
            ->orderBy('employee_number');

        if ($employeeId !== null) {
            $query->where('id', $employeeId);
        }

        $rows = [];
        $total = 0.0;

        foreach ($query->get() as $employee) {
            $preview = $this->forEmployee($employee, $from, $to);

            // Employees with no matching rule and no facts are left out entirely,
            // rather than listed with a zero that invites the question "why nothing?"
            if ($preview['lines'] === []) {
                continue;
            }

            $rows[] = $preview;
            $total += $preview['total'];
        }

        return [
            'period' => [
                'id' => (string) $period->id,
                'code' => $period->code,
                'start_date' => $from,
                'end_date' => $to,
                'status' => $period->status->value,
            ],
            'currency' => $period->currency,
            'employees_with_commission' => count($rows),
            'total_commission' => round($total, 2),
            'employees' => $rows,
            'note' => 'Preview only. Nothing is written until payroll is calculated and approved.',
        ];
    }

    /**
     * One employee's commission, rule by rule, fully worked.
     *
     * @return array<string, mixed>
     */
    public function forEmployee(Employee $employee, string $from, string $to): array
    {
        $earned = $this->engine->calculate($employee, $from, $to);
        $rules = $this->engine->rulesFor($employee, $from);
        $rulesById = collect($rules)->keyBy(fn (CommissionRule $r) => (string) $r->id);

        $lines = [];

        foreach ($earned as $result) {
            $rule = $rulesById->get($result['rule_id']);
            $explanation = $result['explanation'];
            $metric = KpiMetric::tryFrom((string) $result['metric_key']);

            $lines[] = [
                // Employee → Metric → Rule → Calculation → Commission, in order.
                'metric' => [
                    'key' => $result['metric_key'],
                    'label' => $metric?->label() ?? $result['metric_key'],
                    'source_module' => $metric?->sourceModule(),
                    'unit' => $metric?->unit(),
                    'measured_value' => $explanation['measured_value'],
                    'measured_quantity' => $explanation['measured_quantity'],
                    'facts_counted' => $explanation['facts_counted'],
                ],
                'rule' => [
                    'id' => $result['rule_id'],
                    'code' => $result['rule_code'],
                    'name' => $result['rule_name'],
                    'method' => $result['method'],
                    'rate' => $explanation['rate'],
                    'threshold' => $explanation['threshold'],
                    'min_amount' => $explanation['min_amount'],
                    'max_amount' => $explanation['max_amount'],
                    // Which version produced this figure — the answer to "but the
                    // rate is 3% now".
                    'version' => $rule === null ? null : (int) $rule->version,
                    'effective_from' => $rule?->effective_from?->toDateString(),
                    'effective_to' => $rule?->effective_to?->toDateString(),
                ],
                'calculation' => [
                    'formula' => $explanation['formula'],
                    'base' => $explanation['base'],
                    'rate' => $explanation['rate'],
                    // The arithmetic written out the way it would be on paper.
                    'worked' => $this->worked($explanation),
                    'note' => $explanation['note'],
                ],
                'commission' => $result['amount'],
            ];
        }

        return [
            'employee' => [
                'id' => (string) $employee->id,
                'employee_number' => $employee->employee_number,
                'name' => $employee->fullName(),
                'department_id' => $employee->department_id === null ? null : (string) $employee->department_id,
            ],
            'from' => $from,
            'to' => $to,
            'rules_evaluated' => count($rules),
            'lines' => $lines,
            'total' => round(array_sum(array_column($lines, 'commission')), 2),
        ];
    }

    /**
     * Everything behind one line, including the individual facts.
     *
     * The level below the preview: not "sales were 12,500" but the list of
     * documents that added up to 12,500.
     *
     * @return array<string, mixed>
     */
    public function drillDown(Employee $employee, string $ruleId, string $from, string $to): array
    {
        $rule = CommissionRule::query()
            ->with('tiers')
            ->where('company_id', $employee->company_id)
            ->findOrFail($ruleId);

        $result = $this->engine->applyRule($rule, $employee, $from, $to);

        return [
            'employee_id' => (string) $employee->id,
            'rule' => [
                'id' => (string) $rule->id,
                'code' => $rule->code,
                'name' => $rule->name,
                'version' => (int) $rule->version,
                'method' => $rule->method->value,
                'rate' => (float) $rule->rate,
                'effective_from' => $rule->effective_from?->toDateString(),
                'effective_to' => $rule->effective_to?->toDateString(),
            ],
            'result' => $result,
            'traceability' => $this->facts->traceability(
                (string) $employee->company_id,
                (string) $employee->id,
                (string) $rule->metric_key,
                $from,
                $to,
            ),
        ];
    }

    /**
     * The sum as a person would write it: 12,500.00 × 2% = 250.00
     *
     * @param  array<string, mixed>  $explanation
     */
    private function worked(array $explanation): string
    {
        $base = number_format((float) $explanation['base'], 2);
        $rate = (float) $explanation['rate'];
        $amount = number_format((float) $explanation['amount'], 2);

        return match ((string) $explanation['method']) {
            'percentage_of_value', 'tiered' => "{$base} × {$rate}% = {$amount}",
            'amount_per_unit' => "{$base} × {$rate} = {$amount}",
            default => "{$base} → {$amount}",
        };
    }
}
