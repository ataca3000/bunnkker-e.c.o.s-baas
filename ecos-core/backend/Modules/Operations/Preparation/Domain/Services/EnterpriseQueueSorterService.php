<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Services;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Collection as BaseCollection;

/**
 * Sorts preparation wave orders using the 7-criteria enterprise queue priority:
 *
 * 1. delivery_window_starts_at  ASC  — earlier windows first
 * 2. preparation_priority       ASC  — lower number = higher priority
 * 3. zone_code_snapshot         ASC  — alphabetical zone grouping (minimises picker travel)
 * 4. order_confirmed_at         ASC  — oldest confirmed order first (FIFO)
 * 5. is_paid                    DESC — paid orders jump the queue
 * 6. (order value from order)   DESC — higher-value orders first within same tier
 * 7. order_number               ASC  — stable tiebreaker
 */
final class EnterpriseQueueSorterService
{
    /**
     * @param  Collection|BaseCollection  $orders  PreparationWaveOrder collection (optionally with order relation loaded)
     */
    public function sort(Collection|BaseCollection $orders): BaseCollection
    {
        return $orders->sortWith(function ($a, $b): int {
            // 1. Delivery window start time (NULL last)
            $cmp = $this->compareNullableTimes($a->delivery_window_starts_at, $b->delivery_window_starts_at);
            if ($cmp !== 0) {
                return $cmp;
            }

            // 2. Preparation priority (lower = higher priority)
            $cmp = ($a->preparation_priority ?? 5) <=> ($b->preparation_priority ?? 5);
            if ($cmp !== 0) {
                return $cmp;
            }

            // 3. Zone code (group similar zones together)
            $cmp = strcmp($a->zone_code_snapshot ?? 'ZZZ', $b->zone_code_snapshot ?? 'ZZZ');
            if ($cmp !== 0) {
                return $cmp;
            }

            // 4. Order confirmed date (oldest first)
            $cmp = strcmp(
                $a->order_confirmed_at ?? '9999',
                $b->order_confirmed_at ?? '9999',
            );
            if ($cmp !== 0) {
                return $cmp;
            }

            // 5. Paid orders first
            $cmp = (int) ($b->is_paid ?? 0) <=> (int) ($a->is_paid ?? 0);
            if ($cmp !== 0) {
                return $cmp;
            }

            // 6. Order value DESC (requires order relation)
            $aValue = $a->relationLoaded('order') ? (float) ($a->order?->total_amount ?? 0) : 0;
            $bValue = $b->relationLoaded('order') ? (float) ($b->order?->total_amount ?? 0) : 0;
            $cmp = $bValue <=> $aValue;
            if ($cmp !== 0) {
                return $cmp;
            }

            // 7. Stable tiebreaker
            return strcmp($a->order_number ?? '', $b->order_number ?? '');
        })->values();
    }

    private function compareNullableTimes(?string $a, ?string $b): int
    {
        if ($a === null && $b === null) {
            return 0;
        }
        if ($a === null) {
            return 1;
        }   // NULL sorts last
        if ($b === null) {
            return -1;
        }

        return strcmp($a, $b);
    }
}
