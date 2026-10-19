<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Logistics\Network\Domain\Enums\CapacityUnit;
use Modules\Logistics\Network\Domain\Models\CapacitySlot;
use Modules\Logistics\Operations\Domain\Enums\PoolStatus;
use Modules\Logistics\Operations\Domain\Models\ResourcePool;

/**
 * Supply against demand, one row per pool, one column per day.
 *
 * ┌─ DERIVED, NEVER STORED ─────────────────────────────────────────────────┐
 * │ Every cell is computed from the pools and the ledger at read time. A     │
 * │ persisted matrix would be a cache of two other modules' state with no    │
 * │ invalidation story, and it would be wrong within minutes of a vehicle    │
 * │ failing an inspection.                                                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * The matrix answers one question: on which day does this pool run out? It does
 * not predict — it reports what is already committed against what already
 * exists.
 */
class AvailabilityMatrixService
{
    /** A fortnight is as far as anyone plans resources in practice. */
    private const MAX_DAYS = 14;

    public function __construct(
        private readonly UnifiedResourcePoolService $unified,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function build(?string $companyId = null, ?Carbon $from = null, int $days = 7): array
    {
        $from = ($from ?? Carbon::today())->startOfDay();
        $days = max(1, min($days, self::MAX_DAYS));

        $dates = [];

        for ($i = 0; $i < $days; $i++) {
            $dates[] = $from->copy()->addDays($i)->toDateString();
        }

        $pools = ResourcePool::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->where('status', PoolStatus::Active->value)
            ->with('serviceArea')
            ->get();

        $rows = $pools->map(function (ResourcePool $pool) use ($dates) {
            $unified = $this->unified->forPool($pool);
            $counts = $unified['counts'];

            return [
                'pool_id' => $pool->uuid,
                'pool_name' => $pool->name,
                'pool_type' => $pool->pool_type->value,
                'service_area' => $pool->serviceArea?->name,

                // Supply is a today figure. It is repeated across the row rather
                // than projected forward, because a fitness verdict a week out
                // is a guess and this module does not guess.
                'available_vehicles' => $counts['available_vehicles'],
                'available_drivers' => $counts['available_drivers'],
                'supply_is_current_only' => true,

                'cells' => array_map(
                    fn (string $date) => $this->cell($pool, $date, $counts),
                    $dates,
                ),
            ];
        })->values()->all();

        return [
            'from' => $from->toDateString(),
            'dates' => $dates,
            'rows' => $rows,
        ];
    }

    /**
     * @param  array<string, int>  $counts
     * @return array<string, mixed>
     */
    private function cell(ResourcePool $pool, string $date, array $counts): array
    {
        $slots = $this->slotsFor($pool, $date);

        $committed = 0.0;
        $available = 0.0;
        $exhausted = 0;

        foreach ($slots as $slot) {
            // The slot's own accessors, not its raw columns. Reading
            // committed_* directly here would be a second place that knows how
            // capacity is shaped, and it would drift the first time Network
            // changed that shape.
            $committed += $slot->committedFor(CapacityUnit::Orders);
            $available += $slot->availableFor(CapacityUnit::Orders);

            if ($slot->isExhausted()) {
                $exhausted++;
            }
        }

        // Null, not zero: no slot planned for that day is not the same fact as
        // a day with nothing booked.
        $utilisation = $available > 0.0 ? round($committed / $available, 4) : null;

        return [
            'date' => $date,
            'slot_count' => count($slots),
            'committed' => $committed,
            'available' => $available,
            'utilisation' => $utilisation,
            'exhausted_slots' => $exhausted,
            // The pairing that actually limits a day: a pool with vehicles and
            // no drivers fields nothing, and neither number alone shows it.
            'fieldable_units' => min($counts['available_vehicles'], $counts['available_drivers']),
            'has_capacity_plan' => $slots !== [],
        ];
    }

    /** @return list<CapacitySlot> */
    private function slotsFor(ResourcePool $pool, string $date): array
    {
        if ($pool->service_area_id === null) {
            return [];
        }

        return CapacitySlot::query()
            ->whereHas(
                'plan',
                fn ($q) => $q->where('service_area_id', $pool->service_area_id)
                    ->whereDate('plan_date', $date),
            )
            ->get()
            ->all();
    }
}
