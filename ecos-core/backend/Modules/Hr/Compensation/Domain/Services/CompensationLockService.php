<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Hr\Compensation\Domain\Enums\PayrollRunStatus;
use Modules\Hr\Compensation\Domain\Exceptions\CompensationException;
use Modules\Hr\Compensation\Domain\Models\PayrollPeriod;
use Modules\Hr\Compensation\Domain\Models\PayrollRun;

/**
 * What may still be changed, and what has been paid.
 *
 * ┌─ APPROVAL IS THE LINE ──────────────────────────────────────────────────┐
 * │ Approving a payroll run tells Finance what the company owes its people,     │
 * │ and Finance posts it. A bonus edited after that leaves the payslip, the      │
 * │ announcement and the ledger disagreeing, with nothing in the data saying     │
 * │ which is right — so the edit is refused and an adjustment is offered.        │
 * │                                                                            │
 * │ ONE QUESTION, ASKED IN ONE PLACE. Bonuses, deductions and advances all       │
 * │ consult this service rather than each deciding for itself what "approved"    │
 * │ means. Four implementations of a rule this important would eventually        │
 * │ become three implementations and a hole.                                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * The lock is derived from approved RUNS, never from a flag on the record. A
 * boolean would have to be set by something, and whatever failed to set it would
 * be the exact path a correction slipped through.
 */
final class CompensationLockService
{
    /**
     * Is compensation dated here already paid?
     *
     * A date is locked when an approved payroll run covers a period containing it.
     */
    public function isLocked(string $companyId, ?string $onDate = null, ?string $periodId = null): bool
    {
        return $this->lockingPeriod($companyId, $onDate, $periodId) !== null;
    }

    /**
     * The approved period that covers this date, if any.
     *
     * Returned rather than a boolean so callers can name it — "locked by 2026-03,
     * approved on the 2nd" is actionable; "locked" is not.
     */
    public function lockingPeriod(string $companyId, ?string $onDate = null, ?string $periodId = null): ?PayrollPeriod
    {
        // An explicit period wins: a bonus filed against March is March's, whatever
        // date sits on it.
        if ($periodId !== null) {
            $period = PayrollPeriod::query()
                ->where('company_id', $companyId)
                ->where('id', $periodId)
                ->first();

            return $period !== null && $this->hasApprovedRun($period) ? $period : null;
        }

        if ($onDate === null) {
            return null;
        }

        $date = Carbon::parse($onDate)->toDateString();

        $periods = PayrollPeriod::query()
            ->where('company_id', $companyId)
            ->whereDate('start_date', '<=', $date)
            ->whereDate('end_date', '>=', $date)
            ->get();

        foreach ($periods as $period) {
            if ($this->hasApprovedRun($period)) {
                return $period;
            }
        }

        return null;
    }

    /**
     * Refuse the edit if the pay behind it has been approved.
     *
     * The message names the period and points at the way forward, because a
     * refusal that does not say what to do instead just gets worked around.
     */
    public function assertEditable(string $companyId, ?string $onDate = null, ?string $periodId = null): void
    {
        $period = $this->lockingPeriod($companyId, $onDate, $periodId);

        if ($period !== null) {
            throw CompensationException::componentLocked(
                (string) $period->code,
                $period->approved_at?->toDateString() ?? 'an earlier date',
            );
        }
    }

    /**
     * Everything a caller needs to explain the lock to whoever hit it.
     *
     * @return array<string, mixed>
     */
    public function explain(string $companyId, ?string $onDate = null, ?string $periodId = null): array
    {
        $period = $this->lockingPeriod($companyId, $onDate, $periodId);

        if ($period === null) {
            return [
                'is_locked' => false,
                'period' => null,
                'reason' => null,
                'remedy' => null,
            ];
        }

        return [
            'is_locked' => true,
            'period' => [
                'id' => (string) $period->id,
                'code' => $period->code,
                'name' => $period->name,
                'start_date' => $period->start_date?->toDateString(),
                'end_date' => $period->end_date?->toDateString(),
                'approved_at' => $period->approved_at?->toDateTimeString(),
            ],
            'reason' => 'Payroll for '.$period->code.' has been approved and announced to Finance.',
            'remedy' => 'Raise a compensation adjustment against an open period instead. '
                .'The original stays on the record and the correction is approved separately.',
        ];
    }

    /**
     * The open period a correction should be carried in — the earliest period that
     * has not been approved yet.
     */
    public function nextOpenPeriod(string $companyId): ?PayrollPeriod
    {
        return PayrollPeriod::query()
            ->where('company_id', $companyId)
            ->orderBy('start_date')
            ->get()
            ->first(fn (PayrollPeriod $period) => ! $this->hasApprovedRun($period));
    }

    private function hasApprovedRun(PayrollPeriod $period): bool
    {
        return PayrollRun::query()
            ->where('payroll_period_id', $period->id)
            ->where('status', PayrollRunStatus::Approved->value)
            ->exists();
    }
}
