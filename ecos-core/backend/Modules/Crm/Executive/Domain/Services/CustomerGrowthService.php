<?php

declare(strict_types=1);

namespace Modules\Crm\Executive\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Crm\Executive\Domain\Support\ExecutivePeriod;
use Modules\Crm\Executive\Domain\Support\Metric;

/**
 * Customer growth — acquisitions over the period, charted across its buckets.
 *
 * Read-only: counts are taken from `customers.created_at`; the trend is derived,
 * never stored.
 */
final class CustomerGrowthService
{
    /** @return array<string, mixed> */
    public function forPeriod(string $companyId, ExecutivePeriod $period): array
    {
        $previous = $period->previous();

        $acquired = $this->countBetween($companyId, $period->start, $period->end);
        $acquiredPrevious = $this->countBetween($companyId, $previous->start, $previous->end);

        // Base = everything that existed before the window opened.
        $openingBase = DB::table('customers')
            ->where('company_id', $companyId)
            ->whereNull('deleted_at')
            ->where('created_at', '<', $period->start)
            ->count();

        $series = [];
        foreach ($period->buckets() as $bucket) {
            $series[] = [
                'label' => $bucket['label'],
                'start' => $bucket['start']->toDateString(),
                'customers_acquired' => $this->countBetween($companyId, $bucket['start'], $bucket['end']),
            ];
        }

        return [
            'period' => $period->toArray(),
            'opening_customers' => $openingBase,
            'closing_customers' => $openingBase + $acquired,
            'acquired' => Metric::compare($acquired, $acquiredPrevious, 0),
            'growth_rate_percent' => Metric::rate($acquired, max(1, $openingBase)),
            'series' => $series,
        ];
    }

    private function countBetween(string $companyId, $start, $end): int
    {
        return DB::table('customers')
            ->where('company_id', $companyId)
            ->whereNull('deleted_at')
            ->whereBetween('created_at', [$start, $end])
            ->count();
    }
}
