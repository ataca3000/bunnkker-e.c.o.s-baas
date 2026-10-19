<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Logistics\Fleet\Domain\Enums\CostType;
use Modules\Logistics\Fleet\Domain\Events\VehicleCostPosted;
use Modules\Logistics\Fleet\Domain\Models\CostEntry;
use Modules\Logistics\Fleet\Domain\Models\FleetUnit;

/**
 * The operational cost ledger.
 *
 * ┌─ D8 — FLEET OWNS OPERATIONAL COST ONLY ─────────────────────────────────┐
 * │ Accounting remains the financial authority. These entries are expense    │
 * │ FACTS used to compute cost per km / per order / per zone, and are posted │
 * │ onward to Accounting. This is not a ledger of record.                    │
 * │                                                                          │
 * │ It is also NOT trip cash: Distribution remains the Single Cash Authority │
 * │ and nothing here touches distribution_trip_settlements or                │
 * │ distribution_payment_collections.                                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Append-only. A correction is a REVERSING entry pointing at the original —
 * the same discipline the domain applies to inventory movements, and what makes
 * month-end cost reproducible.
 */
class VehicleCostService
{
    public function __construct(
        private readonly OdometerService $odometer,
    ) {}

    /** @param array<string, mixed> $attributes */
    public function post(
        FleetUnit $unit,
        CostType $type,
        float $amount,
        array $attributes = [],
        ?string $actor = null,
    ): CostEntry {
        $entry = DB::transaction(fn () => CostEntry::create($attributes + [
            'fleet_unit_id' => $unit->id,
            'company_id' => $unit->company_id,
            'cost_type' => $type->value,
            'amount' => $amount,
            'currency' => $attributes['currency'] ?? 'EGP',
            'incurred_on' => $attributes['incurred_on'] ?? Carbon::today()->toDateString(),
            'odometer_km' => $attributes['odometer_km'] ?? $this->odometer->currentKm($unit),
        ]));

        VehicleCostPosted::dispatch($entry, $actor);

        return $entry;
    }

    /**
     * Reverse an entry. There is no update path, so this is the only way to
     * correct a mistake — and the original stays visible.
     */
    public function reverse(CostEntry $entry, string $reason, ?int $actorId = null): CostEntry
    {
        return DB::transaction(fn () => CostEntry::create([
            'fleet_unit_id' => $entry->fleet_unit_id,
            'company_id' => $entry->company_id,
            'cost_type' => $entry->cost_type->value,
            'amount' => -1 * (float) $entry->amount,
            'currency' => $entry->currency,
            'incurred_on' => Carbon::today()->toDateString(),
            'odometer_km' => $entry->odometer_km,
            'source_type' => $entry->source_type,
            'source_reference' => $entry->source_reference,
            'reverses_entry_id' => $entry->id,
            'reversal_reason' => $reason,
            'description' => 'Reversal of entry #'.$entry->id,
            'created_by' => $actorId,
        ]));
    }

    /**
     * Monthly straight-line depreciation, posted as an accrual.
     *
     * Idempotent per (unit, month) so a re-run of the scheduled job cannot
     * double-post — the guard is the source_reference, not a job lock.
     */
    public function accrueDepreciation(FleetUnit $unit, ?Carbon $forMonth = null): ?CostEntry
    {
        $amount = $unit->monthlyDepreciation();

        if ($amount === null || $amount <= 0.0) {
            return null;
        }

        $month = ($forMonth ?? Carbon::today())->startOfMonth();
        $reference = 'depreciation:'.$month->format('Y-m');

        $exists = $unit->costEntries()
            ->where('cost_type', CostType::Depreciation->value)
            ->where('source_reference', $reference)
            ->exists();

        if ($exists) {
            return null;
        }

        return $this->post($unit, CostType::Depreciation, $amount, [
            'currency' => $unit->currency ?? 'EGP',
            'incurred_on' => $month->endOfMonth()->toDateString(),
            'source_type' => 'schedule',
            'source_reference' => $reference,
            'description' => 'Monthly depreciation accrual',
        ]);
    }

    // ── Derived metrics ───────────────────────────────────────────────────────

    /**
     * Cost summary for a window, with the derived per-km figure.
     *
     * cost_per_km is null rather than zero when distance is unknown. A silent
     * zero would read as "this vehicle is free to run", which is exactly the
     * kind of confidently-wrong number that erodes trust in a cost report.
     *
     * @return array<string, mixed>
     */
    public function summary(FleetUnit $unit, Carbon $from, Carbon $to): array
    {
        $entries = $unit->costEntries()
            ->whereBetween('incurred_on', [$from->toDateString(), $to->toDateString()])
            ->get();

        $byType = [];
        foreach (CostType::cases() as $type) {
            $byType[$type->value] = round(
                (float) $entries->where('cost_type', $type)->sum('amount'),
                2,
            );
        }

        $total = round((float) $entries->sum('amount'), 2);
        $distance = $this->odometer->distanceBetween($unit, $from, $to);

        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'total' => $total,
            'currency' => $unit->currency ?? 'EGP',
            'by_type' => $byType,
            'distance_km' => $distance,
            'cost_per_km' => $distance !== null && $distance > 0
                ? round($total / $distance, 3)
                : null,
            'entry_count' => $entries->count(),
        ];
    }

    /**
     * Cost per delivered order — BO-2, the number the whole platform exists to
     * move.
     *
     * Order count is supplied by the CALLER rather than queried here, because
     * Fleet may not read Distribution or Delivery (Directive 3). Phase 4+ will
     * pass a figure accumulated from trip-completed events.
     */
    public function costPerOrder(FleetUnit $unit, Carbon $from, Carbon $to, int $orderCount): ?float
    {
        if ($orderCount <= 0) {
            return null;
        }

        $summary = $this->summary($unit, $from, $to);

        return round((float) $summary['total'] / $orderCount, 3);
    }
}
