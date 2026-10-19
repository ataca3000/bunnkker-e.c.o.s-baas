<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Hr\Compensation\Domain\Contracts\ProvidesAbsenceFacts;
use Modules\Hr\Compensation\Domain\Enums\DeductionType;
use Modules\Hr\Compensation\Domain\Models\Advance;
use Modules\Hr\Compensation\Domain\Models\AdvanceInstallment;
use Modules\Hr\Compensation\Domain\Models\Bonus;
use Modules\Hr\Compensation\Domain\Models\Deduction;
use Modules\Hr\Compensation\Domain\Models\PayrollPeriod;
use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * The compensation calculation engine.
 *
 * ┌─ ONE FORMULA · EVERY INPUT NAMED · NOTHING PERSISTED HERE ──────────────┐
 * │                                                                            │
 * │     basic + bonus + commission − advances − approved deductions = net      │
 * │                                                                            │
 * │ This class computes that and returns it; writing payslips is the run        │
 * │ service's job. Every component comes back with the rows that produced it    │
 * │ and the arithmetic that combined them, so a payslip can be explained line   │
 * │ by line without re-running anything.                                       │
 * │                                                                            │
 * │ Deterministic by construction: the same period, the same facts and the      │
 * │ same approved adjustments always produce the same net. Attendance-derived   │
 * │ deductions are the one place the calculator prices something itself, and    │
 * │ it does so from a stated daily rate — Attendance counts the days through    │
 * │ the port, Payroll prices them here.                                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class CompensationCalculator
{
    /** The divisor turning a monthly salary into a daily rate for absence pricing. */
    public const WORKING_DAYS_PER_MONTH = 30;

    public function __construct(
        private readonly SalaryStructureService $salaries,
        private readonly CommissionEngine $commissions,
        private readonly BonusService $bonuses,
        private readonly DeductionService $deductions,
        private readonly AdvanceService $advances,
        private readonly ProvidesAbsenceFacts $absence,
    ) {}

    /**
     * Calculate one employee's compensation for a period.
     *
     * @return array<string, mixed> the components, the totals, the lines and the explanation
     */
    public function calculate(Employee $employee, PayrollPeriod $period): array
    {
        $from = $period->start_date->toDateString();
        $to = $period->end_date->toDateString();

        $basic = $this->basic($employee, $to);
        $bonuses = $this->bonusComponent($employee, $period, $from, $to);
        $commission = $this->commissionComponent($employee, $from, $to);
        $advances = $this->advanceComponent($employee, $to);
        $deductions = $this->deductionComponent($employee, $period, $from, $to, (float) $basic['amount']);

        $gross = round($basic['amount'] + $bonuses['total'] + $commission['total'], 2);
        $net = round($gross - $advances['total'] - $deductions['total'], 2);

        return [
            'employee_id' => (string) $employee->id,
            'employee_number' => $employee->employee_number,
            'employee_name' => $employee->fullName(),
            'currency' => $basic['currency'],
            'basic_salary' => $basic['amount'],
            'bonus_total' => $bonuses['total'],
            'commission_total' => $commission['total'],
            'advance_total' => $advances['total'],
            'deduction_total' => $deductions['total'],
            'gross_salary' => $gross,
            'net_salary' => $net,
            'lines' => array_merge($basic['lines'], $bonuses['lines'], $commission['lines'], $advances['lines'], $deductions['lines']),
            'explanation' => [
                'period' => ['code' => $period->code, 'from' => $from, 'to' => $to],
                'formula' => 'net = basic + bonus + commission − advances − approved deductions',
                'components' => [
                    'basic' => $basic['explanation'],
                    'bonus' => $bonuses['explanation'],
                    'commission' => $commission['explanation'],
                    'advances' => $advances['explanation'],
                    'deductions' => $deductions['explanation'],
                ],
                'gross_salary' => $gross,
                'net_salary' => $net,
                'calculated_at' => Carbon::now()->toDateTimeString(),
            ],
            // Carried so the run service can mark them recovered once a payslip exists.
            'recovered_installments' => $advances['installments'],
        ];
    }

    // ── Components ────────────────────────────────────────────────────────────

    /** @return array<string, mixed> */
    private function basic(Employee $employee, string $asOf): array
    {
        $structure = $this->salaries->inForceOn($employee, $asOf);
        $amount = $structure === null ? 0.0 : round((float) $structure->basic_salary, 2);

        return [
            'amount' => $amount,
            'currency' => $structure->currency ?? 'EGP',
            'lines' => $amount <= 0 ? [] : [[
                'category' => 'basic',
                'code' => 'basic_salary',
                'label' => 'Basic Salary',
                'amount' => $amount,
                'sign' => 1,
                'source_type' => 'salary_structure',
                'source_id' => $structure === null ? null : (string) $structure->id,
                'explanation' => [
                    'effective_from' => $structure?->effective_from?->toDateString(),
                    'pay_frequency' => $structure->pay_frequency ?? null,
                ],
            ]],
            'explanation' => [
                'structure_id' => $structure === null ? null : (string) $structure->id,
                'in_force_on' => $asOf,
                'basic_salary' => $amount,
                'note' => $structure === null ? 'no salary structure in force' : null,
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function bonusComponent(Employee $employee, PayrollPeriod $period, string $from, string $to): array
    {
        $bonuses = $this->bonuses->approvedFor($employee, (string) $period->id, $from, $to);

        $lines = $bonuses->map(fn (Bonus $bonus) => [
            'category' => 'bonus',
            'code' => $bonus->type->value,
            'label' => $bonus->type->label().' — '.$bonus->reason,
            'amount' => round((float) $bonus->amount, 2),
            'sign' => 1,
            'source_type' => 'bonus',
            'source_id' => (string) $bonus->id,
            'explanation' => [
                'awarded_on' => $bonus->awarded_on?->toDateString(),
                'source' => $bonus->source,
                'recommendation_id' => $bonus->recommendation_id,
            ],
        ])->all();

        return [
            'total' => round((float) $bonuses->sum('amount'), 2),
            'lines' => $lines,
            'explanation' => [
                'approved_bonuses' => $bonuses->count(),
                'total' => round((float) $bonuses->sum('amount'), 2),
                'note' => 'only approved bonuses are included',
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function commissionComponent(Employee $employee, string $from, string $to): array
    {
        $earned = $this->commissions->calculate($employee, $from, $to);

        $lines = array_map(fn (array $c) => [
            'category' => 'commission',
            'code' => $c['rule_code'],
            'label' => $c['rule_name'],
            'amount' => $c['amount'],
            'sign' => 1,
            'source_type' => 'commission_rule',
            'source_id' => $c['rule_id'],
            'explanation' => $c['explanation'],
        ], array_filter($earned, fn (array $c) => $c['amount'] > 0));

        return [
            'total' => round(array_sum(array_column($earned, 'amount')), 2),
            'lines' => array_values($lines),
            'explanation' => [
                'rules_applied' => count($earned),
                'rules' => array_map(fn (array $c) => [
                    'code' => $c['rule_code'], 'metric' => $c['metric_key'],
                    'method' => $c['method'], 'amount' => $c['amount'],
                ], $earned),
                'total' => round(array_sum(array_column($earned, 'amount')), 2),
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function advanceComponent(Employee $employee, string $to): array
    {
        $due = $this->advances->dueFor($employee, $to);

        $lines = $due->map(fn (AdvanceInstallment $i) => [
            'category' => 'advance',
            'code' => 'advance_installment',
            'label' => 'Advance '.($i->advance->reference ?? '').' — installment '.$i->sequence.' of '.($i->advance->installments_count ?? 1),
            'amount' => round((float) $i->amount, 2),
            'sign' => -1,
            'source_type' => 'advance_installment',
            'source_id' => (string) $i->id,
            'explanation' => [
                'advance_id' => (string) $i->advance_id,
                'due_date' => $i->due_date?->toDateString(),
                'remaining_after' => $i->advance instanceof Advance
                    ? round($i->advance->remainingBalance() - (float) $i->amount, 2)
                    : null,
            ],
        ])->all();

        return [
            'total' => round((float) $due->sum('amount'), 2),
            'lines' => $lines,
            'installments' => $due->pluck('id')->map(fn ($id) => (string) $id)->all(),
            'explanation' => [
                'installments_due' => $due->count(),
                'total' => round((float) $due->sum('amount'), 2),
                'note' => 'installments scheduled on or before the period end',
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function deductionComponent(
        Employee $employee,
        PayrollPeriod $period,
        string $from,
        string $to,
        float $basicSalary,
    ): array {
        $approved = $this->deductions->approvedFor($employee, (string) $period->id, $from, $to);

        $lines = $approved->map(fn (Deduction $d) => [
            'category' => 'deduction',
            'code' => $d->type->value,
            'label' => $d->type->label().' — '.$d->reason,
            'amount' => round((float) $d->amount, 2),
            'sign' => -1,
            'source_type' => 'deduction',
            'source_id' => (string) $d->id,
            'explanation' => [
                'decided_at' => $d->decided_at?->toDateTimeString(),
                'approver_id' => $d->approver_id,
                'source_module' => $d->source_module,
                'source_reference' => $d->source_reference,
            ],
        ])->all();

        // What attendance says happened — counted by H2, priced here.
        $absence = $this->absence->deductibleDaysFor((string) $employee->id, $from, $to);
        $dailyRate = $basicSalary > 0 ? round($basicSalary / self::WORKING_DAYS_PER_MONTH, 2) : 0.0;

        return [
            'total' => round((float) $approved->sum('amount'), 2),
            'lines' => $lines,
            'explanation' => [
                'approved_deductions' => $approved->count(),
                'total' => round((float) $approved->sum('amount'), 2),
                'by_type' => $approved->groupBy(fn (Deduction $d) => $d->type->value)
                    ->map(fn ($group) => round((float) $group->sum('amount'), 2))->all(),
                // Reported so a payroll officer can see what attendance would justify,
                // but NOT deducted automatically — that is always someone's decision.
                'attendance' => $absence + [
                    'daily_rate' => $dailyRate,
                    'indicative_unpaid_leave_value' => round($absence['unpaid_leave_days'] * $dailyRate, 2),
                    'indicative_absence_value' => round($absence['unauthorized_absence_days'] * $dailyRate, 2),
                    'note' => 'indicative only — a deduction is raised and approved, never applied automatically',
                ],
                'note' => 'only approved deductions are subtracted',
            ],
        ];
    }

    /**
     * The deduction a payroll officer would raise for attendance in a period —
     * offered as a suggestion for the workspace, never applied by the engine.
     *
     * @return array<int, array<string, mixed>>
     */
    public function suggestedAttendanceDeductions(Employee $employee, PayrollPeriod $period): array
    {
        $from = $period->start_date->toDateString();
        $to = $period->end_date->toDateString();

        $structure = $this->salaries->inForceOn($employee, $to);
        $basic = $structure === null ? 0.0 : (float) $structure->basic_salary;

        if ($basic <= 0) {
            return [];
        }

        $dailyRate = round($basic / self::WORKING_DAYS_PER_MONTH, 2);
        $facts = $this->absence->deductibleDaysFor((string) $employee->id, $from, $to);

        $suggestions = [];

        foreach ([
            [DeductionType::UnauthorizedAbsence, $facts['unauthorized_absence_days']],
            [DeductionType::UnpaidLeave, $facts['unpaid_leave_days']],
        ] as [$type, $days]) {
            if ($days > 0) {
                $suggestions[] = [
                    'type' => $type->value,
                    'label' => $type->label(),
                    'days' => $days,
                    'daily_rate' => $dailyRate,
                    'amount' => round($days * $dailyRate, 2),
                    'reason' => "{$days} day(s) of {$type->label()} in {$period->code}",
                    'formula' => 'amount = days × (basic salary ÷ '.self::WORKING_DAYS_PER_MONTH.')',
                ];
            }
        }

        return $suggestions;
    }
}
