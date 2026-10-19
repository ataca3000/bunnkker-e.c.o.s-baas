<?php

declare(strict_types=1);

namespace Modules\Finance\Fiscal\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Finance\Fiscal\Domain\Enums\PeriodStatus;
use Modules\Finance\Fiscal\Domain\Models\FiscalPeriod;
use Modules\Finance\Fiscal\Domain\Models\FiscalYear;
use Modules\Finance\Ledger\Domain\Exceptions\FinanceException;

/**
 * The fiscal calendar — years, periods, and the open/close/lock lifecycle that
 * gates every posting.
 *
 * The only writer of finance_fiscal_years and finance_fiscal_periods. Period
 * status is the single most consequential flag in Finance: the Journal Engine
 * refuses any entry into a period that is not open.
 */
class FiscalCalendarService
{
    /**
     * Create a fiscal year and its twelve monthly periods (period 1 opens; the
     * rest wait as `future`).
     */
    public function createYear(
        string $companyId,
        string $name,
        Carbon $start,
        Carbon $end,
        ?int $actorId = null,
        int $periodCount = 12,
    ): FiscalYear {
        return DB::transaction(function () use ($companyId, $name, $start, $end, $actorId, $periodCount) {
            $year = FiscalYear::create([
                'company_id' => $companyId,
                'name' => $name,
                'start_date' => $start->toDateString(),
                'end_date' => $end->toDateString(),
                'created_by' => $actorId,
            ]);

            $cursor = $start->copy();
            for ($n = 1; $n <= $periodCount; $n++) {
                $periodEnd = $cursor->copy()->endOfMonth();
                if ($n === $periodCount || $periodEnd->greaterThan($end)) {
                    $periodEnd = $end->copy();
                }

                FiscalPeriod::create([
                    'company_id' => $companyId,
                    'fiscal_year_id' => $year->id,
                    'period_number' => $n,
                    'name' => $cursor->format('Y-m'),
                    'start_date' => $cursor->toDateString(),
                    'end_date' => $periodEnd->toDateString(),
                    // The first period opens so the year is immediately usable.
                    'status' => $n === 1 ? PeriodStatus::Open->value : PeriodStatus::Future->value,
                    'opened_at' => $n === 1 ? now() : null,
                ]);

                $cursor = $periodEnd->copy()->addDay()->startOfDay();
            }

            return $year->refresh();
        });
    }

    public function openPeriod(FiscalPeriod $period): FiscalPeriod
    {
        $this->assertTransition($period, PeriodStatus::Open);

        if (! $period->year->isOpen()) {
            throw FinanceException::periodHasNoOpenYear();
        }

        $period->update(['status' => PeriodStatus::Open->value, 'opened_at' => now()]);

        return $period->refresh();
    }

    public function closePeriod(FiscalPeriod $period, ?int $actorId = null): FiscalPeriod
    {
        $this->assertTransition($period, PeriodStatus::Closed);

        $period->update([
            'status' => PeriodStatus::Closed->value,
            'closed_at' => now(),
            'closed_by' => $actorId,
        ]);

        return $period->refresh();
    }

    /** Permanent. A locked period can never accept or change a posting again. */
    public function lockPeriod(FiscalPeriod $period, ?int $actorId = null): FiscalPeriod
    {
        $this->assertTransition($period, PeriodStatus::Locked);

        $period->update([
            'status' => PeriodStatus::Locked->value,
            'locked_at' => now(),
            'locked_by' => $actorId,
        ]);

        return $period->refresh();
    }

    private function assertTransition(FiscalPeriod $period, PeriodStatus $target): void
    {
        if (! $period->status->canTransitionTo($target)) {
            throw FinanceException::invalidPeriodTransition($period->status->value, $target->value);
        }
    }
}
