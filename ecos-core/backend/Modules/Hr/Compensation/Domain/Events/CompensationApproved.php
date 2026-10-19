<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Events;

use Illuminate\Support\Carbon;

/**
 * Approved compensation, announced for Finance.
 *
 * ┌─ THE HANDOVER · AND THE LINE HR DOES NOT CROSS ─────────────────────────┐
 * │ HR calculates what each person is owed and, on approval, says so. What      │
 * │ happens next — the journal entries, the accrual, the actual payment — is    │
 * │ Finance's alone. This event is the entire interface between them.          │
 * │                                                                            │
 * │ Note what is absent: no account codes, no debit and credit sides, no        │
 * │ posting date. Those are accounting decisions, and encoding them here would  │
 * │ make HR a bookkeeper. The event carries the WHAT — totals, currency, the    │
 * │ per-employee net — and leaves the HOW to the module that owns it.          │
 * │                                                                            │
 * │ It is a plain announcement: nothing in HR listens to it, and Finance may    │
 * │ subscribe whenever it is ready without HR changing.                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class CompensationApproved
{
    /**
     * @param  array<int, array{employee_id: string, employee_number: string, net_salary: float,
     *     gross_salary: float, basic_salary: float, bonus_total: float, commission_total: float,
     *     advance_total: float, deduction_total: float}>  $employees
     */
    public function __construct(
        public readonly string $companyId,
        public readonly string $payrollRunId,
        public readonly string $payrollPeriodId,
        public readonly string $periodCode,
        public readonly string $periodStart,
        public readonly string $periodEnd,
        public readonly float $totalGross,
        public readonly float $totalNet,
        public readonly float $totalDeductions,
        public readonly float $totalAdvances,
        public readonly string $currency,
        public readonly array $employees,
        public readonly Carbon $approvedAt,
        public readonly ?int $approvedBy = null,
    ) {}

    /** Dot-notation name, the convention the enterprise bus routes on. */
    public function eventName(): string
    {
        return 'hr.compensation.approved';
    }

    /** Stable and derived from the run, so a replay is recognised as the same event. */
    public function eventId(): string
    {
        return 'hr.compensation.approved:'.$this->payrollRunId;
    }

    /**
     * The flat payload a subscriber reads. Amounts are keyed by name so Finance
     * can map them to accounts without HR knowing what those accounts are.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'company_id' => $this->companyId,
            'payroll_run_id' => $this->payrollRunId,
            'payroll_period_id' => $this->payrollPeriodId,
            'period_code' => $this->periodCode,
            'period_start' => $this->periodStart,
            'period_end' => $this->periodEnd,
            'currency' => $this->currency,
            'total_gross' => $this->totalGross,
            'total_net' => $this->totalNet,
            'total_deductions' => $this->totalDeductions,
            'total_advances' => $this->totalAdvances,
            'employees_count' => count($this->employees),
            'employees' => $this->employees,
            'approved_at' => $this->approvedAt->toDateTimeString(),
            'approved_by' => $this->approvedBy,
        ];
    }
}
