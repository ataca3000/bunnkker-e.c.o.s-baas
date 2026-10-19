<?php

declare(strict_types=1);

namespace Modules\Finance\Closing\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Finance\Closing\Domain\Enums\PeriodCloseType;
use Modules\Finance\Closing\Domain\Models\PeriodClosure;
use Modules\Finance\Fiscal\Domain\Enums\PeriodStatus;
use Modules\Finance\Fiscal\Domain\Models\FiscalPeriod;
use Modules\Finance\Fiscal\Domain\Services\FiscalCalendarService;
use Modules\Finance\Ledger\Domain\Exceptions\FinanceException;

/**
 * Period closing governance — soft close, hard close and the reopen workflow.
 *
 * ┌─ ORCHESTRATES F1, NEVER REDEFINES IT ───────────────────────────────────┐
 * │ The F1 fiscal period is the posting gate and the single source of truth   │
 * │ for status. This service only drives F1's sanctioned transitions          │
 * │ (open→closed→locked, closed→open) and records an accountable governance    │
 * │ entry for each. A soft close is reversible by an authorised reopen; a hard │
 * │ close locks the period permanently and requires a prior soft close.        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class PeriodClosingService
{
    public function __construct(private readonly FiscalCalendarService $calendar) {}

    /** Soft close: closed to routine posting, still reopenable. */
    public function softClose(FiscalPeriod $period, ?int $actorId = null, ?string $reason = null): FiscalPeriod
    {
        if ($period->status !== PeriodStatus::Open) {
            throw FinanceException::periodAlreadyClosed($period->name);
        }

        return DB::transaction(function () use ($period, $actorId, $reason): FiscalPeriod {
            $closed = $this->calendar->closePeriod($period, $actorId);
            $this->log($period, 'soft_close', PeriodCloseType::Soft, 'open', 'closed', $actorId, $reason);

            return $closed;
        });
    }

    /** Hard close: permanent lock. Requires a prior soft close. */
    public function hardClose(FiscalPeriod $period, ?int $actorId = null, ?string $reason = null): FiscalPeriod
    {
        if ($period->status !== PeriodStatus::Closed) {
            throw FinanceException::hardCloseRequiresSoftClose($period->name);
        }

        return DB::transaction(function () use ($period, $actorId, $reason): FiscalPeriod {
            $locked = $this->calendar->lockPeriod($period, $actorId);
            $this->log($period, 'hard_close', PeriodCloseType::Hard, 'closed', 'locked', $actorId, $reason);

            return $locked;
        });
    }

    /** Reopen a soft-closed period for late adjustments (authorised). */
    public function reopen(FiscalPeriod $period, int $actorId, string $reason): FiscalPeriod
    {
        if ($period->status === PeriodStatus::Locked) {
            throw FinanceException::reopenNotAllowed($period->name);
        }
        if ($period->status !== PeriodStatus::Closed) {
            throw FinanceException::periodAlreadyClosed($period->name);
        }

        return DB::transaction(function () use ($period, $actorId, $reason): FiscalPeriod {
            $opened = $this->calendar->openPeriod($period);
            $this->log($period, 'reopen', null, 'closed', 'open', $actorId, $reason);

            return $opened;
        });
    }

    private function log(FiscalPeriod $period, string $action, ?PeriodCloseType $type, string $from, string $to, ?int $actorId, ?string $reason): void
    {
        PeriodClosure::create([
            'company_id' => $period->company_id,
            'fiscal_period_id' => $period->id,
            'action' => $action,
            'close_type' => $type?->value,
            'from_status' => $from,
            'to_status' => $to,
            'reason' => $reason,
            'actor_id' => $actorId,
        ]);
    }
}
