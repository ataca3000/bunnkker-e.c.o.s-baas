<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Logistics\Fleet\Domain\Enums\OdometerSource;
use Modules\Logistics\Fleet\Domain\Events\OdometerRolledBack;
use Modules\Logistics\Fleet\Domain\Models\FleetUnit;
use Modules\Logistics\Fleet\Domain\Models\OdometerReading;

/**
 * The SINGLE writer of odometer data.
 *
 * Readings arrive from fuel stops, inspections, maintenance, manual entry and
 * (eventually) telemetry. Several uncoordinated writers guarantee an
 * inconsistent series, and distance is the denominator of nearly every cost
 * metric in Fleet — so contention is resolved in exactly one place.
 *
 * Conflict rule: a reading below the current accepted value is RECORDED but not
 * ACCEPTED. It is never silently dropped, because a rolled-back odometer is
 * evidence of a data or hardware problem worth investigating.
 */
class OdometerService
{
    /** Tolerance for float noise when comparing readings, in km. */
    private const EPSILON = 0.05;

    /**
     * Record a reading against the governed series.
     *
     * Returns the persisted reading, whose is_accepted flag states whether it
     * moved the unit's current value.
     */
    public function record(
        FleetUnit $unit,
        float $readingKm,
        OdometerSource $source,
        ?Carbon $recordedAt = null,
        ?string $sourceReference = null,
        ?int $actorId = null,
    ): OdometerReading {
        $recordedAt ??= Carbon::now();
        $current = $unit->current_odometer_km !== null ? (float) $unit->current_odometer_km : null;

        $isRollback = $current !== null && $readingKm < ($current - self::EPSILON);

        $reading = DB::transaction(function () use (
            $unit, $readingKm, $source, $recordedAt, $sourceReference, $actorId, $isRollback, $current
        ) {
            $reading = OdometerReading::create([
                'fleet_unit_id' => $unit->id,
                'company_id' => $unit->company_id,
                'reading_km' => $readingKm,
                'source' => $source->value,
                'recorded_at' => $recordedAt,
                'is_accepted' => ! $isRollback,
                'rejection_reason' => $isRollback
                    ? sprintf('Below the accepted reading of %.1f km.', $current)
                    : null,
                'source_reference' => $sourceReference,
                'recorded_by' => $actorId,
            ]);

            if (! $isRollback) {
                $unit->update([
                    'current_odometer_km' => $readingKm,
                    'odometer_updated_at' => $recordedAt,
                ]);
            }

            return $reading;
        });

        if ($isRollback) {
            OdometerRolledBack::dispatch($reading);
        }

        return $reading;
    }

    /** The canonical current value. Everything distance-based reads this. */
    public function currentKm(FleetUnit $unit): ?float
    {
        return $unit->current_odometer_km !== null ? (float) $unit->current_odometer_km : null;
    }

    /**
     * The last accepted reading at or before a moment — the baseline for
     * fuel-efficiency computation.
     *
     * `<=` rather than `<` because timestamps have one-second resolution and a
     * fuel stop routinely lands in the same second as the reading that precedes
     * it (an API flow, or a bulk card import). A strict comparison silently
     * returned no baseline in that case, which made efficiency null for the
     * first fill on every fast-entry path. Callers evaluate this BEFORE writing
     * their own reading, so `<=` cannot match the reading being created.
     */
    public function readingBefore(FleetUnit $unit, Carbon $before): ?float
    {
        $reading = $unit->odometerReadings()
            ->where('is_accepted', true)
            ->where('recorded_at', '<=', $before)
            ->reorder('recorded_at', 'desc')
            ->first();

        return $reading === null ? null : (float) $reading->reading_km;
    }

    /**
     * Distance between two moments. Null when there are fewer than two accepted
     * readings — returning zero would silently inflate every cost-per-km figure
     * that divides by it.
     */
    public function distanceBetween(FleetUnit $unit, Carbon $from, Carbon $to): ?float
    {
        $readings = $unit->odometerReadings()
            ->where('is_accepted', true)
            ->whereBetween('recorded_at', [$from, $to])
            ->reorder('recorded_at')
            ->pluck('reading_km');

        if ($readings->count() < 2) {
            return null;
        }

        return round((float) $readings->last() - (float) $readings->first(), 1);
    }

    /**
     * Has this unit gone quiet? A vehicle with no reading for weeks silently
     * distorts every cost report, so staleness is surfaced as a data-quality
     * signal rather than discovered at month end.
     */
    public function isStale(FleetUnit $unit, int $thresholdDays = 14): bool
    {
        if ($unit->odometer_updated_at === null) {
            return true;
        }

        return $unit->odometer_updated_at->lt(Carbon::now()->subDays($thresholdDays));
    }
}
