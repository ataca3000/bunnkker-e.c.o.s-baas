<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Logistics\Fleet\Domain\Enums\CostType;
use Modules\Logistics\Fleet\Domain\Enums\FuelTransactionStatus;
use Modules\Logistics\Fleet\Domain\Enums\OdometerSource;
use Modules\Logistics\Fleet\Domain\Events\FuelAnomalyDetected;
use Modules\Logistics\Fleet\Domain\Events\FuelTransactionRecorded;
use Modules\Logistics\Fleet\Domain\Exceptions\FleetException;
use Modules\Logistics\Fleet\Domain\Models\FleetUnit;
use Modules\Logistics\Fleet\Domain\Models\FuelTransaction;

/**
 * Fuel capture, validation and reconciliation.
 *
 * Validation raises FLAGS, it does not reject. Most anomalies are real
 * purchases with an unusual pattern, and auto-rejecting them teaches operators
 * to ignore the flag — which is worse than not having one. Only a structurally
 * impossible transaction (no odometer) is refused outright.
 *
 * Cash boundary (D8): a reconciled or written-off transaction posts an EXPENSE
 * entry to the Fleet cost ledger, which Accounting consumes. It never touches
 * trip cash — Distribution remains the Single Cash Authority.
 */
class FuelReconciliationService
{
    /** Litres per 100 km beyond the vehicle's own baseline before flagging. */
    private const EFFICIENCY_TOLERANCE = 0.35;

    /** Two fill-ups closer together than this are suspicious. */
    private const OVERLAP_MINUTES = 30;

    /** Sanity ceiling for a single fill, in litres. */
    private const MAX_PLAUSIBLE_LITRES = 400.0;

    public function __construct(
        private readonly OdometerService $odometer,
        private readonly VehicleCostService $costs,
    ) {}

    /**
     * Capture a purchase and run validation in one step.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function capture(
        FleetUnit $unit,
        array $attributes,
        ?int $actorId = null,
        ?string $actor = null,
    ): FuelTransaction {
        if (! isset($attributes['odometer_km'])) {
            throw FleetException::fuelNeedsOdometer();
        }

        $transactedAt = isset($attributes['transacted_at'])
            ? Carbon::parse($attributes['transacted_at'])
            : Carbon::now();

        $odometerKm = (float) $attributes['odometer_km'];

        $transaction = DB::transaction(function () use (
            $unit, $attributes, $transactedAt, $odometerKm, $actorId
        ) {
            $previousKm = $this->odometer->readingBefore($unit, $transactedAt);

            $transaction = $unit->fuelTransactions()->create($attributes + [
                'company_id' => $unit->company_id,
                'transacted_at' => $transactedAt,
                'status' => FuelTransactionStatus::Captured->value,
                'recorded_by' => $actorId,
            ]);

            $transaction->efficiency_l_per_100km = $transaction->computeEfficiency($previousKm);

            $flags = $this->detectAnomalies($unit, $transaction, $previousKm, $transactedAt);
            $transaction->has_anomaly = $flags !== [];
            $transaction->anomaly_flags = $flags === [] ? null : $flags;
            $transaction->status = FuelTransactionStatus::Validated->value;
            $transaction->save();

            // The odometer service decides whether the reading is accepted; a
            // rollback is recorded for review rather than silently applied.
            $this->odometer->record(
                $unit,
                $odometerKm,
                OdometerSource::FuelStop,
                $transactedAt,
                $transaction->uuid,
                $actorId,
            );

            return $transaction->refresh();
        });

        FuelTransactionRecorded::dispatch($transaction, $actor);

        if ($transaction->has_anomaly) {
            FuelAnomalyDetected::dispatch($transaction, $actor);
        }

        return $transaction;
    }

    /** Match to a statement or receipt, and post the expense. */
    public function reconcile(
        FuelTransaction $transaction,
        ?int $actorId = null,
        ?string $actor = null,
    ): FuelTransaction {
        $this->assertTransition($transaction, FuelTransactionStatus::Reconciled);

        $reconciled = DB::transaction(function () use ($transaction, $actorId) {
            $transaction->update([
                'status' => FuelTransactionStatus::Reconciled->value,
                'reconciled_at' => now(),
                'reconciled_by' => $actorId,
            ]);

            return $transaction->refresh();
        });

        $this->postCost($reconciled, $actor);

        return $reconciled;
    }

    public function dispute(FuelTransaction $transaction, string $reason, ?int $actorId = null): FuelTransaction
    {
        $this->assertTransition($transaction, FuelTransactionStatus::Disputed);

        if (trim($reason) === '') {
            throw FleetException::fuelResolutionReasonRequired();
        }

        $transaction->update([
            'status' => FuelTransactionStatus::Disputed->value,
            'resolution_reason' => $reason,
            'reconciled_by' => $actorId,
        ]);

        return $transaction->refresh();
    }

    /** Accept the loss. Still posts a cost — the money left the business. */
    public function writeOff(
        FuelTransaction $transaction,
        string $reason,
        ?int $actorId = null,
        ?string $actor = null,
    ): FuelTransaction {
        $this->assertTransition($transaction, FuelTransactionStatus::WrittenOff);

        if (trim($reason) === '') {
            throw FleetException::fuelResolutionReasonRequired();
        }

        $written = DB::transaction(function () use ($transaction, $reason, $actorId) {
            $transaction->update([
                'status' => FuelTransactionStatus::WrittenOff->value,
                'resolution_reason' => $reason,
                'reconciled_at' => now(),
                'reconciled_by' => $actorId,
            ]);

            return $transaction->refresh();
        });

        $this->postCost($written, $actor);

        return $written;
    }

    /** Refuse the transaction entirely. Posts nothing. */
    public function reject(FuelTransaction $transaction, string $reason): FuelTransaction
    {
        $this->assertTransition($transaction, FuelTransactionStatus::Rejected);

        if (trim($reason) === '') {
            throw FleetException::fuelResolutionReasonRequired();
        }

        $transaction->update([
            'status' => FuelTransactionStatus::Rejected->value,
            'resolution_reason' => $reason,
        ]);

        return $transaction->refresh();
    }

    /**
     * Fuel efficiency over a window: total litres per 100 km actually driven.
     *
     * @return array<string, mixed>
     */
    public function efficiency(FleetUnit $unit, Carbon $from, Carbon $to): array
    {
        $transactions = $unit->fuelTransactions()
            ->whereBetween('transacted_at', [$from, $to])
            ->whereIn('status', [
                FuelTransactionStatus::Validated->value,
                FuelTransactionStatus::Reconciled->value,
            ])
            ->get();

        $litres = round((float) $transactions->sum('litres'), 3);
        $cost = round((float) $transactions->sum('cost'), 2);
        $distance = $this->odometer->distanceBetween($unit, $from, $to);

        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'transaction_count' => $transactions->count(),
            'total_litres' => $litres,
            'total_cost' => $cost,
            'distance_km' => $distance,
            // Null rather than zero — see VehicleCostService::summary().
            'l_per_100km' => $distance !== null && $distance > 0
                ? round(($litres / $distance) * 100, 3)
                : null,
            'cost_per_km' => $distance !== null && $distance > 0
                ? round($cost / $distance, 3)
                : null,
            'anomaly_count' => $transactions->where('has_anomaly', true)->count(),
        ];
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /** @return list<string> */
    private function detectAnomalies(
        FleetUnit $unit,
        FuelTransaction $transaction,
        ?float $previousKm,
        Carbon $transactedAt,
    ): array {
        $flags = [];

        // 1. Odometer monotonicity — the most common source of corrupt data.
        if ($previousKm !== null && (float) $transaction->odometer_km < $previousKm) {
            $flags[] = FuelTransaction::ANOMALY_ODOMETER_ROLLBACK;
        }

        // 2. Tank plausibility.
        if ((float) $transaction->litres > self::MAX_PLAUSIBLE_LITRES) {
            $flags[] = FuelTransaction::ANOMALY_TANK_IMPLAUSIBLE;
        }

        // 3. Efficiency against this vehicle's own recent baseline. Comparing a
        // vehicle to itself catches both mechanical decline and fuel theft;
        // comparing to a manufacturer figure catches neither.
        $efficiency = $transaction->efficiency_l_per_100km;
        if ($efficiency !== null) {
            $baseline = $this->baselineEfficiency($unit, $transaction->id);

            if ($baseline !== null
                && $baseline > 0
                && ((float) $efficiency - $baseline) / $baseline > self::EFFICIENCY_TOLERANCE) {
                $flags[] = FuelTransaction::ANOMALY_EFFICIENCY_OUTLIER;
            }
        }

        // 4. Temporal overlap — two fills minutes apart suggests card misuse.
        $overlapping = $unit->fuelTransactions()
            ->where('id', '!=', $transaction->id)
            ->whereBetween('transacted_at', [
                $transactedAt->copy()->subMinutes(self::OVERLAP_MINUTES),
                $transactedAt->copy()->addMinutes(self::OVERLAP_MINUTES),
            ])
            ->exists();

        if ($overlapping) {
            $flags[] = FuelTransaction::ANOMALY_TEMPORAL_OVERLAP;
        }

        return $flags;
    }

    /** Mean efficiency of the last few fills, excluding the one being judged. */
    private function baselineEfficiency(FleetUnit $unit, int $excludeId): ?float
    {
        $values = $unit->fuelTransactions()
            ->where('id', '!=', $excludeId)
            ->whereNotNull('efficiency_l_per_100km')
            ->limit(5)
            ->pluck('efficiency_l_per_100km')
            ->map(static fn ($v) => (float) $v);

        if ($values->count() < 3) {
            return null;
        }

        return (float) $values->avg();
    }

    private function postCost(FuelTransaction $transaction, ?string $actor): void
    {
        $unit = $transaction->unit;

        if ($unit === null) {
            return;
        }

        $this->costs->post(
            $unit,
            CostType::Fuel,
            (float) $transaction->cost,
            [
                'currency' => $transaction->currency,
                'incurred_on' => $transaction->transacted_at->toDateString(),
                'odometer_km' => $transaction->odometer_km,
                'source_type' => 'fuel_transaction',
                'source_reference' => $transaction->uuid,
                'description' => sprintf(
                    '%.3f L at %s',
                    (float) $transaction->litres,
                    $transaction->station ?? 'unknown station',
                ),
            ],
            $actor,
        );
    }

    private function assertTransition(FuelTransaction $transaction, FuelTransactionStatus $target): void
    {
        if (! $transaction->status->canTransitionTo($target)) {
            throw FleetException::invalidFuelTransition($transaction->status, $target);
        }
    }
}
