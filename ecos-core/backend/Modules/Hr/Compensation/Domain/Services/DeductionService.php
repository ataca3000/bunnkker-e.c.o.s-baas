<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Hr\Compensation\Domain\Enums\ApprovalStatus;
use Modules\Hr\Compensation\Domain\Enums\DeductionType;
use Modules\Hr\Compensation\Domain\Exceptions\CompensationException;
use Modules\Hr\Compensation\Domain\Models\Deduction;
use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * Deductions — raised, decided, and only then paid attention to by the calculator.
 *
 * ┌─ A DEDUCTION IS A DECISION, NOT A CALCULATION ──────────────────────────┐
 * │ Nothing here deducts money automatically. An unauthorised absence, a       │
 * │ shortage found in a stock count, a penalty — each is RAISED with a reason  │
 * │ and an amount, and someone with the authority to do so approves it. Only   │
 * │ approved deductions reach a payslip, which is why the status machine       │
 * │ matters more than the arithmetic.                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class DeductionService
{
    public function __construct(private readonly CompensationLockService $lock) {}

    public function raise(Employee $employee, array $data, ?int $actorId = null): Deduction
    {
        $amount = round((float) ($data['amount'] ?? 0), 2);

        if ($amount <= 0) {
            throw CompensationException::amountMustBePositive();
        }

        $type = ($data['type'] ?? null) instanceof DeductionType
            ? $data['type']
            : (DeductionType::tryFrom((string) ($data['type'] ?? '')) ?? DeductionType::Manual);

        // Part 7 — nothing is raised against pay that has already been approved.
        $this->lock->assertEditable(
            (string) $employee->company_id,
            (string) ($data['deduction_date'] ?? Carbon::now()->toDateString()),
            $data['payroll_period_id'] ?? null,
        );

        return Deduction::create([
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'payroll_period_id' => $data['payroll_period_id'] ?? null,
            'type' => $type->value,
            'amount' => $amount,
            'currency' => $data['currency'] ?? 'EGP',
            'deduction_date' => $data['deduction_date'] ?? Carbon::now()->toDateString(),
            'reason' => $data['reason'],
            'decision' => $data['decision'] ?? null,
            'status' => ApprovalStatus::Pending->value,
            'notes' => $data['notes'] ?? null,
            // Reference-only: Inventory owns the discrepancy, HR owns the recovery.
            'source_module' => $data['source_module'] ?? $type->sourceModule(),
            'source_reference' => $data['source_reference'] ?? null,
            'created_by' => $actorId,
        ]);
    }

    public function approve(Deduction $deduction, ?int $approverId = null, ?string $decision = null): Deduction
    {
        $this->assertTransition($deduction, ApprovalStatus::Approved);
        $this->assertEditable($deduction);

        $deduction->update([
            'status' => ApprovalStatus::Approved->value,
            'approver_id' => $approverId,
            'decided_at' => Carbon::now(),
            'decision' => $decision ?? $deduction->decision,
        ]);

        return $deduction->refresh();
    }

    public function reject(Deduction $deduction, ?int $approverId = null, ?string $decision = null): Deduction
    {
        $this->assertTransition($deduction, ApprovalStatus::Rejected);
        $this->assertEditable($deduction);

        $deduction->update([
            'status' => ApprovalStatus::Rejected->value,
            'approver_id' => $approverId,
            'decided_at' => Carbon::now(),
            'decision' => $decision ?? $deduction->decision,
        ]);

        return $deduction->refresh();
    }

    public function cancel(Deduction $deduction): Deduction
    {
        $this->assertTransition($deduction, ApprovalStatus::Cancelled);
        $this->assertEditable($deduction);
        $deduction->update(['status' => ApprovalStatus::Cancelled->value]);

        return $deduction->refresh();
    }

    /** Part 7 — refuse the change if the pay behind it has been approved. */
    private function assertEditable(Deduction $deduction): void
    {
        $this->lock->assertEditable(
            (string) $deduction->company_id,
            $deduction->deduction_date?->toDateString(),
            $deduction->payroll_period_id === null ? null : (string) $deduction->payroll_period_id,
        );
    }

    /**
     * The approved deductions that apply to one employee for a period — either
     * attached to it explicitly, or falling inside its dates.
     *
     * @return \Illuminate\Database\Eloquent\Collection<int, Deduction>
     */
    public function approvedFor(Employee $employee, ?string $periodId, string $from, string $to)
    {
        return Deduction::query()
            ->where('employee_id', $employee->id)
            ->approved()
            ->where(function ($q) use ($periodId, $from, $to): void {
                $q->whereBetween('deduction_date', [$from, $to]);
                if ($periodId !== null) {
                    $q->orWhere('payroll_period_id', $periodId);
                }
            })
            ->orderBy('deduction_date')
            ->get();
    }

    private function assertTransition(Deduction $deduction, ApprovalStatus $target): void
    {
        if (! $deduction->status->canTransitionTo($target)) {
            throw CompensationException::invalidApprovalTransition($deduction->status->value, $target->value);
        }
    }
}
