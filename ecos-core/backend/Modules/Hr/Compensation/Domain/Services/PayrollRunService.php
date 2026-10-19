<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Modules\Hr\Compensation\Domain\Enums\PayrollPeriodStatus;
use Modules\Hr\Compensation\Domain\Enums\PayrollRunStatus;
use Modules\Hr\Compensation\Domain\Events\CompensationApproved;
use Modules\Hr\Compensation\Domain\Exceptions\CompensationException;
use Modules\Hr\Compensation\Domain\Models\AdvanceInstallment;
use Modules\Hr\Compensation\Domain\Models\PayrollPeriod;
use Modules\Hr\Compensation\Domain\Models\PayrollRun;
use Modules\Hr\Compensation\Domain\Models\Payslip;
use Modules\Hr\Compensation\Domain\Models\PayslipLine;
use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * Running and approving payroll.
 *
 * ┌─ RECALCULATE FREELY · APPROVE ONCE ─────────────────────────────────────┐
 * │ Before approval a period can be recalculated as often as needed — a new    │
 * │ run replaces the last, because a payroll officer correcting an input       │
 * │ should not have to unpick anything. Approval is the one-way door: it        │
 * │ freezes the payslips, recovers the advance installments they took, and      │
 * │ announces the totals for Finance. A correction after that is a new run,     │
 * │ never an edit.                                                             │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class PayrollRunService
{
    public function __construct(private readonly CompensationCalculator $calculator) {}

    // ── Periods ───────────────────────────────────────────────────────────────

    public function createPeriod(string $companyId, array $data): PayrollPeriod
    {
        $start = Carbon::parse($data['start_date']);

        return PayrollPeriod::create([
            'company_id' => $companyId,
            'code' => $data['code'] ?? $start->format('Y-m'),
            'name' => $data['name'] ?? $start->format('F Y'),
            'start_date' => $start->toDateString(),
            'end_date' => Carbon::parse($data['end_date'] ?? $start->copy()->endOfMonth())->toDateString(),
            'payment_date' => $data['payment_date'] ?? null,
            'status' => PayrollPeriodStatus::Draft->value,
            'currency' => $data['currency'] ?? 'EGP',
            'notes' => $data['notes'] ?? null,
        ]);
    }

    public function openPeriod(PayrollPeriod $period): PayrollPeriod
    {
        return $this->movePeriod($period, PayrollPeriodStatus::Open);
    }

    public function closePeriod(PayrollPeriod $period): PayrollPeriod
    {
        return $this->movePeriod($period, PayrollPeriodStatus::Closed);
    }

    // ── Calculation ───────────────────────────────────────────────────────────

    /**
     * Calculate the whole period. Replaces any previous unapproved run, so
     * recalculating is always safe.
     */
    public function calculate(PayrollPeriod $period, ?int $actorId = null): PayrollRun
    {
        if (! $period->status->isRecalculable()) {
            throw CompensationException::periodNotRecalculable($period->status->value);
        }

        $employees = Employee::query()
            ->where('company_id', $period->company_id)
            ->whereNotIn('status', ['terminated', 'resigned'])
            ->orderBy('employee_number')
            ->get();

        return DB::transaction(function () use ($period, $employees, $actorId): PayrollRun {
            // A recalculation supersedes the last attempt rather than stacking on it.
            PayrollRun::query()
                ->where('payroll_period_id', $period->id)
                ->where('status', '!=', PayrollRunStatus::Approved->value)
                ->each(fn (PayrollRun $run) => $run->delete());

            $run = PayrollRun::create([
                'company_id' => $period->company_id,
                'payroll_period_id' => $period->id,
                'reference' => $this->nextRunReference((string) $period->company_id),
                'status' => PayrollRunStatus::Calculated->value,
                'currency' => $period->currency,
                'calculated_at' => Carbon::now(),
                'calculated_by' => $actorId,
            ]);

            $totals = [
                'basic' => 0.0, 'bonus' => 0.0, 'commission' => 0.0,
                'advances' => 0.0, 'deductions' => 0.0, 'gross' => 0.0, 'net' => 0.0,
            ];
            $counted = 0;

            foreach ($employees as $employee) {
                $result = $this->calculator->calculate($employee, $period);

                // Nothing to pay and nothing to take — no payslip is produced.
                if ($result['gross_salary'] <= 0 && $result['deduction_total'] <= 0 && $result['advance_total'] <= 0) {
                    continue;
                }

                $this->writePayslip($run, $period, $employee, $result);

                $totals['basic'] += $result['basic_salary'];
                $totals['bonus'] += $result['bonus_total'];
                $totals['commission'] += $result['commission_total'];
                $totals['advances'] += $result['advance_total'];
                $totals['deductions'] += $result['deduction_total'];
                $totals['gross'] += $result['gross_salary'];
                $totals['net'] += $result['net_salary'];
                $counted++;
            }

            $run->update([
                'employees_count' => $counted,
                'total_basic' => round($totals['basic'], 2),
                'total_bonus' => round($totals['bonus'], 2),
                'total_commission' => round($totals['commission'], 2),
                'total_advances' => round($totals['advances'], 2),
                'total_deductions' => round($totals['deductions'], 2),
                'total_gross' => round($totals['gross'], 2),
                'total_net' => round($totals['net'], 2),
            ]);

            $period->update([
                'status' => PayrollPeriodStatus::Calculated->value,
                'calculated_at' => Carbon::now(),
            ]);

            return $run->refresh();
        });
    }

    // ── Approval ──────────────────────────────────────────────────────────────

    /**
     * Approve a run: freeze the payslips, recover the installments they took, and
     * announce the result for Finance.
     */
    public function approve(PayrollRun $run, ?int $approverId = null): PayrollRun
    {
        if ($run->isApproved()) {
            throw CompensationException::alreadyApproved();
        }

        if (! $run->status->canTransitionTo(PayrollRunStatus::Approved)) {
            throw CompensationException::invalidRunTransition($run->status->value, PayrollRunStatus::Approved->value);
        }

        $approved = DB::transaction(function () use ($run, $approverId): PayrollRun {
            $now = Carbon::now();

            $run->payslips()->update(['status' => 'approved', 'approved_at' => $now]);
            $this->recoverInstallments($run);

            $run->update([
                'status' => PayrollRunStatus::Approved->value,
                'approved_at' => $now,
                'approved_by' => $approverId,
            ]);

            $period = $run->period;
            if ($period !== null && $period->status->canTransitionTo(PayrollPeriodStatus::Approved)) {
                $period->update([
                    'status' => PayrollPeriodStatus::Approved->value,
                    'approved_at' => $now,
                    'approved_by' => $approverId,
                ]);
            }

            return $run->refresh();
        });

        // Announced after the transaction commits — Finance is told about facts
        // that are already durable, never about a state that might roll back.
        Event::dispatch($this->approvalEvent($approved, $approverId));

        return $approved;
    }

    /** The event Finance consumes. Exposed so it can be asserted and replayed. */
    public function approvalEvent(PayrollRun $run, ?int $approverId = null): CompensationApproved
    {
        $period = $run->period;

        $employees = $run->payslips()->with('employee:id,employee_number')->get()
            ->map(fn (Payslip $p) => [
                'employee_id' => (string) $p->employee_id,
                'employee_number' => (string) ($p->employee->employee_number ?? ''),
                'basic_salary' => (float) $p->basic_salary,
                'bonus_total' => (float) $p->bonus_total,
                'commission_total' => (float) $p->commission_total,
                'advance_total' => (float) $p->advance_total,
                'deduction_total' => (float) $p->deduction_total,
                'gross_salary' => (float) $p->gross_salary,
                'net_salary' => (float) $p->net_salary,
            ])->all();

        return new CompensationApproved(
            companyId: (string) $run->company_id,
            payrollRunId: (string) $run->id,
            payrollPeriodId: (string) $run->payroll_period_id,
            periodCode: (string) ($period->code ?? ''),
            periodStart: (string) ($period?->start_date?->toDateString() ?? ''),
            periodEnd: (string) ($period?->end_date?->toDateString() ?? ''),
            totalGross: (float) $run->total_gross,
            totalNet: (float) $run->total_net,
            totalDeductions: (float) $run->total_deductions,
            totalAdvances: (float) $run->total_advances,
            currency: (string) $run->currency,
            employees: $employees,
            approvedAt: $run->approved_at ?? Carbon::now(),
            approvedBy: $approverId ?? $run->approved_by,
        );
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /** @param array<string, mixed> $result */
    private function writePayslip(PayrollRun $run, PayrollPeriod $period, Employee $employee, array $result): Payslip
    {
        $payslip = Payslip::create([
            'company_id' => $run->company_id,
            'payroll_run_id' => $run->id,
            'payroll_period_id' => $period->id,
            'employee_id' => $employee->id,
            'payslip_number' => $period->code.'-'.$employee->employee_number,
            'basic_salary' => $result['basic_salary'],
            'bonus_total' => $result['bonus_total'],
            'commission_total' => $result['commission_total'],
            'advance_total' => $result['advance_total'],
            'deduction_total' => $result['deduction_total'],
            'gross_salary' => $result['gross_salary'],
            'net_salary' => $result['net_salary'],
            'currency' => $result['currency'],
            'status' => 'calculated',
            'explanation' => $result['explanation'] + ['recovered_installments' => $result['recovered_installments']],
            'calculated_at' => Carbon::now(),
        ]);

        $sequence = 1;
        foreach ($result['lines'] as $line) {
            PayslipLine::create($line + ['payslip_id' => $payslip->id, 'sequence' => $sequence++]);
        }

        return $payslip;
    }

    /** Mark every installment a payslip took as recovered, once the run is approved. */
    private function recoverInstallments(PayrollRun $run): void
    {
        foreach ($run->payslips()->get() as $payslip) {
            $ids = (array) (($payslip->explanation ?? [])['recovered_installments'] ?? []);

            if ($ids === []) {
                continue;
            }

            AdvanceInstallment::query()->whereIn('id', $ids)->get()
                ->each(function (AdvanceInstallment $installment) use ($payslip, $run): void {
                    $installment->update([
                        'status' => \Modules\Hr\Compensation\Domain\Enums\InstallmentStatus::Recovered->value,
                        'recovered_at' => Carbon::now(),
                        'payslip_id' => (string) $payslip->id,
                        'payroll_period_id' => $run->payroll_period_id,
                    ]);

                    $advance = $installment->advance;
                    if ($advance !== null) {
                        $fresh = $advance->refresh();
                        $fresh->update([
                            'status' => $fresh->isFullyRecovered()
                                ? \Modules\Hr\Compensation\Domain\Enums\AdvanceStatus::Settled->value
                                : \Modules\Hr\Compensation\Domain\Enums\AdvanceStatus::Active->value,
                            'settled_at' => $fresh->isFullyRecovered() ? Carbon::now() : null,
                        ]);
                    }
                });
        }
    }

    private function movePeriod(PayrollPeriod $period, PayrollPeriodStatus $target): PayrollPeriod
    {
        if (! $period->status->canTransitionTo($target)) {
            throw CompensationException::invalidPeriodTransition($period->status->value, $target->value);
        }

        $period->update([
            'status' => $target->value,
            'closed_at' => $target === PayrollPeriodStatus::Closed ? Carbon::now() : $period->closed_at,
        ]);

        return $period->refresh();
    }

    private function nextRunReference(string $companyId): string
    {
        $last = PayrollRun::query()
            ->where('company_id', $companyId)
            ->where('reference', 'like', 'RUN-%')
            ->orderByDesc('reference')
            ->value('reference');

        $next = $last === null ? 1 : ((int) substr((string) $last, 4)) + 1;

        return 'RUN-'.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
