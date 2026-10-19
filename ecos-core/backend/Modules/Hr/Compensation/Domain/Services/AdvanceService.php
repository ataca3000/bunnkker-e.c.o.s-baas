<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Hr\Compensation\Domain\Enums\AdvanceStatus;
use Modules\Hr\Compensation\Domain\Enums\AdvanceType;
use Modules\Hr\Compensation\Domain\Enums\InstallmentStatus;
use Modules\Hr\Compensation\Domain\Exceptions\CompensationException;
use Modules\Hr\Compensation\Domain\Models\Advance;
use Modules\Hr\Compensation\Domain\Models\AdvanceInstallment;
use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * Advances and the schedule that recovers them.
 *
 * ┌─ THE SCHEDULE IS WRITTEN UP FRONT ──────────────────────────────────────┐
 * │ Approving an advance generates every installment at once, so the employee  │
 * │ and the company can both see exactly what will come off which month. The   │
 * │ remaining balance is then simply the installments not yet taken — it is    │
 * │ never a stored number that could drift from the schedule.                  │
 * │                                                                            │
 * │ Rounding is settled on the LAST installment, so the parts always add back  │
 * │ up to the whole and nobody is left owing a stray piastre.                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class AdvanceService
{
    public function __construct(private readonly CompensationLockService $lock) {}

    public function request(Employee $employee, array $data, ?int $actorId = null): Advance
    {
        $amount = round((float) ($data['amount'] ?? 0), 2);

        if ($amount <= 0) {
            throw CompensationException::amountMustBePositive();
        }

        // Part 7 — an advance cannot be requested against a period already paid.
        $this->lock->assertEditable(
            (string) $employee->company_id,
            (string) ($data['requested_on'] ?? Carbon::now()->toDateString()),
        );

        $type = ($data['type'] ?? null) instanceof AdvanceType
            ? $data['type']
            : (AdvanceType::tryFrom((string) ($data['type'] ?? '')) ?? AdvanceType::OneTime);

        $installments = (int) ($data['installments_count'] ?? $type->defaultInstallments());

        if ($type === AdvanceType::Installment && $installments < 2) {
            throw CompensationException::installmentsRequired();
        }

        if ($type === AdvanceType::OneTime) {
            $installments = 1;
        }

        return Advance::create([
            'company_id' => $employee->company_id,
            'employee_id' => $employee->id,
            'reference' => $data['reference'] ?? $this->nextReference((string) $employee->company_id),
            'type' => $type->value,
            'amount' => $amount,
            'currency' => $data['currency'] ?? 'EGP',
            'installments_count' => $installments,
            'installment_amount' => round($amount / $installments, 2),
            'requested_on' => $data['requested_on'] ?? Carbon::now()->toDateString(),
            'first_recovery_date' => $data['first_recovery_date'] ?? Carbon::now()->addMonthNoOverflow()->startOfMonth()->toDateString(),
            'status' => AdvanceStatus::Pending->value,
            'reason' => $data['reason'] ?? null,
            'created_by' => $actorId,
        ]);
    }

    /** Approve, and lay out the whole recovery schedule. */
    public function approve(Advance $advance, ?int $approverId = null): Advance
    {
        $this->assertTransition($advance, AdvanceStatus::Approved);
        $this->lock->assertEditable(
            (string) $advance->company_id,
            $advance->requested_on?->toDateString(),
        );

        return DB::transaction(function () use ($advance, $approverId): Advance {
            $advance->update([
                'status' => AdvanceStatus::Approved->value,
                'approved_by' => $approverId,
                'approved_at' => Carbon::now(),
            ]);

            $this->generateSchedule($advance->refresh());

            return $advance->refresh();
        });
    }

    public function cancel(Advance $advance): Advance
    {
        $this->assertTransition($advance, AdvanceStatus::Cancelled);

        return DB::transaction(function () use ($advance): Advance {
            // Only what has not been recovered yet can be called off.
            $advance->installments()
                ->where('status', InstallmentStatus::Scheduled->value)
                ->update(['status' => InstallmentStatus::Cancelled->value]);

            $advance->update(['status' => AdvanceStatus::Cancelled->value]);

            return $advance->refresh();
        });
    }

    /**
     * The installments due by a date for one employee — what payroll should
     * recover this period.
     *
     * @return \Illuminate\Database\Eloquent\Collection<int, AdvanceInstallment>
     */
    public function dueFor(Employee $employee, string $byDate)
    {
        return AdvanceInstallment::query()
            ->with('advance')
            ->whereHas('advance', function ($q) use ($employee): void {
                $q->where('employee_id', $employee->id)
                    ->whereIn('status', [AdvanceStatus::Approved->value, AdvanceStatus::Active->value]);
            })
            ->dueBy($byDate)
            ->orderBy('due_date')
            ->get();
    }

    /** Mark an installment recovered by a payslip, settling the advance when it is the last. */
    public function markRecovered(AdvanceInstallment $installment, string $payslipId, ?string $periodId = null): AdvanceInstallment
    {
        $advance = $installment->advance;

        if ($advance !== null && ! $advance->status->isRecoverable()) {
            throw CompensationException::advanceNotRecoverable($advance->status->value);
        }

        return DB::transaction(function () use ($installment, $payslipId, $periodId, $advance): AdvanceInstallment {
            $installment->update([
                'status' => InstallmentStatus::Recovered->value,
                'recovered_at' => Carbon::now(),
                'payslip_id' => $payslipId,
                'payroll_period_id' => $periodId ?? $installment->payroll_period_id,
            ]);

            if ($advance !== null) {
                $fresh = $advance->refresh();

                $fresh->update([
                    'status' => $fresh->isFullyRecovered()
                        ? AdvanceStatus::Settled->value
                        : AdvanceStatus::Active->value,
                    'settled_at' => $fresh->isFullyRecovered() ? Carbon::now() : null,
                ]);
            }

            return $installment->refresh();
        });
    }

    /** @return array<string, mixed> */
    public function balanceFor(Employee $employee): array
    {
        $advances = Advance::query()
            ->with('installments')
            ->where('employee_id', $employee->id)
            ->whereIn('status', [
                AdvanceStatus::Approved->value, AdvanceStatus::Active->value, AdvanceStatus::Settled->value,
            ])
            ->get();

        $outstanding = round($advances->sum(fn (Advance $a) => $a->remainingBalance()), 2);

        return [
            'advances' => $advances->count(),
            'total_advanced' => round((float) $advances->sum('amount'), 2),
            'total_recovered' => round($advances->sum(fn (Advance $a) => $a->recoveredAmount()), 2),
            'remaining_balance' => $outstanding,
            'active_advances' => $advances->filter(fn (Advance $a) => $a->remainingBalance() > 0)->count(),
        ];
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function generateSchedule(Advance $advance): void
    {
        if ($advance->installments()->exists()) {
            return;
        }

        $count = max(1, (int) $advance->installments_count);
        $total = round((float) $advance->amount, 2);
        $each = round($total / $count, 2);
        $start = Carbon::parse($advance->first_recovery_date ?? Carbon::now());

        $allocated = 0.0;

        for ($sequence = 1; $sequence <= $count; $sequence++) {
            // The final installment absorbs the rounding so the parts sum to the whole.
            $amount = $sequence === $count ? round($total - $allocated, 2) : $each;
            $allocated = round($allocated + $amount, 2);

            AdvanceInstallment::create([
                'company_id' => $advance->company_id,
                'advance_id' => $advance->id,
                'sequence' => $sequence,
                'amount' => $amount,
                'due_date' => $start->copy()->addMonthsNoOverflow($sequence - 1)->toDateString(),
                'status' => InstallmentStatus::Scheduled->value,
            ]);
        }
    }

    private function assertTransition(Advance $advance, AdvanceStatus $target): void
    {
        if (! $advance->status->canTransitionTo($target)) {
            throw CompensationException::invalidApprovalTransition($advance->status->value, $target->value);
        }
    }

    private function nextReference(string $companyId): string
    {
        $last = Advance::query()
            ->where('company_id', $companyId)
            ->where('reference', 'like', 'ADV-%')
            ->orderByDesc('reference')
            ->value('reference');

        $next = $last === null ? 1 : ((int) substr((string) $last, 4)) + 1;

        return 'ADV-'.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
