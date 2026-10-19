<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Logistics\Distribution\Domain\Enums\DeliveryStopStatus;
use Modules\Logistics\Distribution\Domain\Events\DeliveryStopCompleted;
use Modules\Logistics\Distribution\Domain\Exceptions\DistributionException;
use Modules\Logistics\Distribution\Domain\Models\DeliveryAction;
use Modules\Logistics\Distribution\Domain\Models\DeliveryException;
use Modules\Logistics\Distribution\Domain\Models\DeliveryProof;
use Modules\Logistics\Distribution\Domain\Models\DeliveryStop;
use Modules\Logistics\Distribution\Domain\Models\Trip;
use Modules\Logistics\Distribution\Domain\Models\TripReturn;

/**
 * Delivery execution: stops, actions, proof, exceptions and returns.
 *
 * Execution is only permitted while the trip is on the road, so a stop can
 * never be completed against a trip still being planned or already closed.
 */
class DeliveryService
{
    /**
     * Build the stop list from the trip's assigned orders.
     * Idempotent — re-running will not duplicate stops, thanks to the
     * (trip_id, order_id) unique index and the skip below.
     *
     * @return int number of stops created
     */
    public function generateStops(Trip $trip): int
    {
        return DB::transaction(function () use ($trip) {
            $existing = $trip->stops()->pluck('order_id')->all();
            $sequence = (int) $trip->stops()->max('sequence');
            $created = 0;

            foreach ($trip->tripOrders()->get() as $tripOrder) {
                if (in_array($tripOrder->order_id, $existing, true)) {
                    continue;
                }

                $trip->stops()->create([
                    'order_id' => $tripOrder->order_id,
                    'sequence' => ++$sequence,
                    'status' => DeliveryStopStatus::Pending->value,
                ]);
                $created++;
            }

            return $created;
        });
    }

    public function startStop(DeliveryStop $stop, ?string $actor = null): DeliveryStop
    {
        $this->assertTripOnTheRoad($stop);

        if ($stop->isSettled()) {
            throw DistributionException::stopAlreadySettled();
        }

        $stop->update([
            'status' => DeliveryStopStatus::InProgress->value,
            'attempted_at' => $stop->attempted_at ?? now(),
        ]);

        return $stop->refresh();
    }

    /**
     * Record the outcome of a stop.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function completeStop(
        DeliveryStop $stop,
        DeliveryStopStatus $outcome,
        array $attributes = [],
        ?string $actor = null,
    ): DeliveryStop {
        $this->assertTripOnTheRoad($stop);

        if ($stop->isSettled()) {
            throw DistributionException::stopAlreadySettled();
        }

        if (! $outcome->isSettled()) {
            throw DistributionException::stopAlreadySettled();
        }

        $updated = DB::transaction(function () use ($stop, $outcome, $attributes) {
            $stop->update(array_merge($attributes, [
                'status' => $outcome->value,
                'completed_at' => now(),
                'attempted_at' => $stop->attempted_at ?? now(),
            ]));

            return $stop->refresh();
        });

        DeliveryStopCompleted::dispatch($updated, $outcome, $actor);

        return $updated;
    }

    /** @param array<string, mixed> $attributes */
    public function recordAction(DeliveryStop $stop, array $attributes, ?int $actorId = null): DeliveryAction
    {
        return $stop->actions()->create($attributes + ['performed_by' => $actorId]);
    }

    /** @param array<string, mixed> $attributes */
    public function captureProof(DeliveryStop $stop, array $attributes, ?int $actorId = null): DeliveryProof
    {
        return $stop->proof()->create($attributes + [
            'captured_at' => now(),
            'captured_by' => $actorId,
        ]);
    }

    /** @param array<string, mixed> $attributes */
    public function raiseException(Trip $trip, array $attributes, ?int $actorId = null): DeliveryException
    {
        return $trip->exceptions()->create($attributes + ['reported_by' => $actorId]);
    }

    public function resolveException(
        DeliveryException $exception,
        ?string $notes = null,
        ?int $actorId = null,
    ): DeliveryException {
        $exception->update([
            'resolved_at' => now(),
            'resolved_by' => $actorId,
            'resolution_notes' => $notes,
        ]);

        return $exception->refresh();
    }

    /**
     * Record a return — product or custody. The discrepancy is derived rather
     * than trusted from the caller.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function recordReturn(Trip $trip, array $attributes, ?int $actorId = null): TripReturn
    {
        return DB::transaction(function () use ($trip, $attributes, $actorId) {
            $return = $trip->returns()->create($attributes + ['reported_by' => $actorId]);

            if ($return->warehouse_confirmed_qty !== null) {
                $return->update(['discrepancy_qty' => $return->calculateDiscrepancy()]);
            }

            return $return->refresh();
        });
    }

    /** Warehouse counts what actually came back; discrepancy and liability follow. */
    public function confirmReturn(
        TripReturn $return,
        float $confirmedQty,
        bool $driverLiable = false,
        ?int $actorId = null,
    ): TripReturn {
        return DB::transaction(function () use ($return, $confirmedQty, $driverLiable, $actorId) {
            $return->update([
                'warehouse_confirmed_qty' => $confirmedQty,
                'warehouse_confirmed_at' => now(),
                'warehouse_confirmed_by' => $actorId,
            ]);

            $return->refresh();
            $return->update([
                'discrepancy_qty' => $return->calculateDiscrepancy(),
                'driver_liable' => $driverLiable || $return->hasDiscrepancy(),
            ]);

            return $return->refresh();
        });
    }

    private function assertTripOnTheRoad(DeliveryStop $stop): void
    {
        $trip = $stop->trip;

        if ($trip === null || ! $trip->status->acceptsDeliveryExecution()) {
            throw DistributionException::deliveryNotOnTheRoad(
                $trip?->status ?? \Modules\Logistics\Distribution\Domain\Enums\TripStatus::Planning
            );
        }
    }
}
