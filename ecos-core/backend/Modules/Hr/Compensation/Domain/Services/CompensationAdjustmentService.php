<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Hr\Compensation\Domain\Enums\AdjustmentComponent;
use Modules\Hr\Compensation\Domain\Enums\AdjustmentStatus;
use Modules\Hr\Compensation\Domain\Exceptions\CompensationException;
use Modules\Hr\Compensation\Domain\Models\CompensationAdjustment;
use Modules\Hr\Compensation\Domain\Models\PayrollPeriod;
use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * Correcting pay that has already been approved.
 *
 * ┌─ THE MISTAKE STAYS VISIBLE ─────────────────────────────────────────────┐
 * │ An adjustment does not repair the original — it sits beside it. March's      │
 * │ payslip still says what it said and still matches what Finance posted;       │
 * │ April carries the correction, with the reason and the approver on it.        │
 * │                                                                            │
 * │ That is the whole design. An audit that cannot see the error cannot see      │
 * │ the correction either, and "we fixed it quietly" is indistinguishable from   │
 * │ "we changed it quietly".                                                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Two people, two acts: raising an adjustment and approving one are separate
 * permissions, because the entire point is that changing approved pay is not one
 * person's decision.
 */
final class CompensationAdjustmentService
{
    public function __construct(private readonly CompensationLockService $lock) {}

    /**
     * Raise a correction.
     *
     * @param  array<string, mixed>  $data
     */
    public function raise(Employee $employee, AdjustmentComponent $component, array $data, ?int $actorId = null): CompensationAdjustment
    {
        $reason = trim((string) ($data['reason'] ?? ''));

        if ($reason === '') {
            throw CompensationException::adjustmentReasonRequired();
        }

        $companyId = (string) $employee->company_id;

        // The correction must land somewhere that has not been approved, or it
        // would need correcting the moment it was made.
        $carrier = $this->resolveCarrierPeriod($companyId, $data['payroll_period_id'] ?? null);

        return CompensationAdjustment::create([
            'company_id' => $companyId,
            'employee_id' => $employee->id,
            'reference' => $this->nextReference($companyId),
            'original_period_id' => $data['original_period_id'] ?? null,
            'payroll_period_id' => $carrier->id,
            'component' => $component->value,
            'original_type' => $data['original_type'] ?? $component->originalTable(),
            'original_id' => $data['original_id'] ?? null,
            'original_amount' => $data['original_amount'] ?? null,
            'amount' => round((float) $data['amount'], 2),
            'currency' => $data['currency'] ?? 'EGP',
            'reason' => $reason,
            'notes' => $data['notes'] ?? null,
            'status' => AdjustmentStatus::Pending->value,
            'requested_by' => $actorId,
            'requested_at' => Carbon::now(),
        ]);
    }

    public function approve(CompensationAdjustment $adjustment, ?int $approverId = null, ?string $note = null): CompensationAdjustment
    {
        $this->assertTransition($adjustment, AdjustmentStatus::Approved);

        // The carrier period may have been approved while this sat pending. Re-check
        // rather than trusting the answer from when it was raised.
        $this->assertCarrierStillOpen($adjustment);

        $adjustment->update([
            'status' => AdjustmentStatus::Approved->value,
            'approved_by' => $approverId,
            'approved_at' => Carbon::now(),
            'decision_note' => $note,
        ]);

        return $adjustment->refresh();
    }

    public function reject(CompensationAdjustment $adjustment, ?int $approverId = null, ?string $note = null): CompensationAdjustment
    {
        $this->assertTransition($adjustment, AdjustmentStatus::Rejected);

        $adjustment->update([
            'status' => AdjustmentStatus::Rejected->value,
            'approved_by' => $approverId,
            'approved_at' => Carbon::now(),
            'decision_note' => $note,
        ]);

        return $adjustment->refresh();
    }

    public function cancel(CompensationAdjustment $adjustment, ?string $note = null): CompensationAdjustment
    {
        $this->assertTransition($adjustment, AdjustmentStatus::Cancelled);

        $adjustment->update([
            'status' => AdjustmentStatus::Cancelled->value,
            'decision_note' => $note,
        ]);

        return $adjustment->refresh();
    }

    /**
     * Mark an adjustment as carried by a payslip.
     *
     * Called by payroll when the run that included it is approved, so "approved but
     * never paid" cannot hide.
     */
    public function markApplied(CompensationAdjustment $adjustment, string $payslipId): CompensationAdjustment
    {
        $this->assertTransition($adjustment, AdjustmentStatus::Applied);

        $adjustment->update([
            'status' => AdjustmentStatus::Applied->value,
            'applied_at' => Carbon::now(),
            'applied_payslip_id' => $payslipId,
        ]);

        return $adjustment->refresh();
    }

    // ── Reading ───────────────────────────────────────────────────────────────

    /**
     * Approved adjustments waiting to be paid in a period.
     *
     * @return \Illuminate\Database\Eloquent\Collection<int, CompensationAdjustment>
     */
    public function payableIn(string $companyId, string $periodId, ?string $employeeId = null)
    {
        $query = CompensationAdjustment::query()
            ->where('company_id', $companyId)
            ->payableIn($periodId);

        if ($employeeId !== null) {
            $query->where('employee_id', $employeeId);
        }

        return $query->orderBy('created_at')->get();
    }

    /**
     * The signed total an employee's next payslip should carry.
     *
     * Returned with its components, never as a bare number — an unexplained line
     * on a payslip is a support ticket.
     *
     * @return array<string, mixed>
     */
    public function totalFor(string $companyId, string $periodId, string $employeeId): array
    {
        $adjustments = $this->payableIn($companyId, $periodId, $employeeId);

        return [
            'total' => round((float) $adjustments->sum(fn (CompensationAdjustment $a) => (float) $a->amount), 2),
            'count' => $adjustments->count(),
            'adjustments' => $adjustments->map(fn (CompensationAdjustment $a) => [
                'id' => (string) $a->id,
                'reference' => $a->reference,
                'component' => $a->component->value,
                'amount' => (float) $a->amount,
                'reason' => $a->reason,
                'approved_by' => $a->approved_by,
                'approved_at' => $a->approved_at?->toDateTimeString(),
            ])->all(),
        ];
    }

    /**
     * The full audit trail for one employee.
     *
     * @return array<int, array<string, mixed>>
     */
    public function historyFor(string $companyId, string $employeeId): array
    {
        return CompensationAdjustment::query()
            ->where('company_id', $companyId)
            ->where('employee_id', $employeeId)
            ->orderByDesc('requested_at')
            ->get()
            ->map(fn (CompensationAdjustment $a) => $a->auditTrail())
            ->all();
    }

    /**
     * The queue an approver works through.
     *
     * @return array<int, array<string, mixed>>
     */
    public function pendingFor(string $companyId): array
    {
        return CompensationAdjustment::query()
            ->with('employee:id,employee_number,first_name,last_name')
            ->where('company_id', $companyId)
            ->where('status', AdjustmentStatus::Pending->value)
            ->orderBy('requested_at')
            ->get()
            ->map(fn (CompensationAdjustment $a) => [
                'id' => (string) $a->id,
                'reference' => $a->reference,
                'employee_id' => (string) $a->employee_id,
                'employee_number' => $a->employee?->employee_number,
                'employee_name' => $a->employee?->fullName(),
                'component' => $a->component->value,
                'component_label' => $a->component->label(),
                'amount' => (float) $a->amount,
                'currency' => $a->currency,
                'direction' => $a->isCredit() ? 'pays more' : 'recovers',
                'reason' => $a->reason,
                'requested_by' => $a->requested_by,
                'requested_at' => $a->requested_at?->toDateTimeString(),
                'carried_in_period_id' => $a->payroll_period_id === null ? null : (string) $a->payroll_period_id,
            ])->all();
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function resolveCarrierPeriod(string $companyId, mixed $requestedPeriodId): PayrollPeriod
    {
        if ($requestedPeriodId !== null) {
            $period = PayrollPeriod::query()
                ->where('company_id', $companyId)
                ->where('id', $requestedPeriodId)
                ->first();

            if ($period === null || $this->lock->isLocked($companyId, null, (string) $period->id)) {
                throw CompensationException::adjustmentNeedsOpenPeriod();
            }

            return $period;
        }

        $period = $this->lock->nextOpenPeriod($companyId);

        if ($period === null) {
            throw CompensationException::adjustmentNeedsOpenPeriod();
        }

        return $period;
    }

    private function assertCarrierStillOpen(CompensationAdjustment $adjustment): void
    {
        if ($adjustment->payroll_period_id === null) {
            throw CompensationException::adjustmentNeedsOpenPeriod();
        }

        if ($this->lock->isLocked((string) $adjustment->company_id, null, (string) $adjustment->payroll_period_id)) {
            throw CompensationException::adjustmentNeedsOpenPeriod();
        }
    }

    private function assertTransition(CompensationAdjustment $adjustment, AdjustmentStatus $target): void
    {
        if (! $adjustment->status->canTransitionTo($target)) {
            throw CompensationException::invalidAdjustmentTransition($adjustment->status->value, $target->value);
        }
    }

    private function nextReference(string $companyId): string
    {
        $last = CompensationAdjustment::query()
            ->where('company_id', $companyId)
            ->where('reference', 'like', 'ADJ-%')
            ->orderByDesc('reference')
            ->value('reference');

        $next = $last === null ? 1 : ((int) substr((string) $last, 4)) + 1;

        return 'ADJ-'.str_pad((string) $next, 5, '0', STR_PAD_LEFT);
    }
}
