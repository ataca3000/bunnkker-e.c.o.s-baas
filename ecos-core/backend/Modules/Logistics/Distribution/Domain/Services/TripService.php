<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Logistics\Distribution\Domain\Enums\TripStatus;
use Modules\Logistics\Distribution\Domain\Events\TripDispatched;
use Modules\Logistics\Distribution\Domain\Events\TripStatusChanged;
use Modules\Logistics\Distribution\Domain\Exceptions\DistributionException;
use Modules\Logistics\Distribution\Domain\Models\Trip;
use Modules\Logistics\Distribution\Domain\Models\TripCustody;
use Modules\Logistics\Distribution\Domain\Models\TripOrder;
use Modules\Logistics\Drivers\Domain\Models\DriverVehicleAssignment;

/**
 * Owns the trip lifecycle, order assignment and custody.
 *
 * Resource readiness is delegated to the aggregates that own it — this service
 * never re-derives whether a driver may drive or a vehicle may roll.
 */
class TripService
{
    /** @param array<string, mixed> $attributes */
    public function create(array $attributes, ?string $actor = null): Trip
    {
        return DB::transaction(function () use ($attributes) {
            $attributes['trip_number'] ??= $this->nextTripNumber($attributes['company_id'] ?? null);

            return Trip::create($attributes);
        });
    }

    /** @param array<string, mixed> $attributes */
    public function update(Trip $trip, array $attributes): Trip
    {
        // Status only moves through changeStatus() so the transition table always applies.
        unset($attributes['status']);

        return DB::transaction(function () use ($trip, $attributes) {
            $trip->update($attributes);

            return $trip->refresh();
        });
    }

    public function changeStatus(
        Trip $trip,
        TripStatus $target,
        ?string $reason = null,
        ?string $actor = null,
    ): Trip {
        $current = $trip->status;

        if ($current === $target) {
            return $trip;
        }

        if (! $current->canTransitionTo($target)) {
            throw DistributionException::invalidTripTransition($current, $target);
        }

        // Dispatch is gated on readiness, not just on the transition table.
        if ($target === TripStatus::Dispatched) {
            $blockers = $trip->dispatchBlockers();
            if ($blockers !== []) {
                throw DistributionException::dispatchBlocked($blockers);
            }
        }

        $updated = DB::transaction(function () use ($trip, $target) {
            $payload = ['status' => $target->value];

            if ($target === TripStatus::Dispatched) {
                $payload['dispatched_at'] = now();
            }

            $trip->update($payload);

            return $trip->refresh();
        });

        TripStatusChanged::dispatch($updated, $current, $target, $reason, $actor);

        if ($target === TripStatus::Dispatched) {
            TripDispatched::dispatch($updated, $actor);
        }

        return $updated;
    }

    // ── Order assignment ──────────────────────────────────────────────────────

    /**
     * Assign an order to a trip.
     *
     * Enforces: the trip must be editable, must have capacity, and the order
     * must not already sit on another trip (the unique index is the backstop).
     */
    public function assignOrder(
        Trip $trip,
        string $orderId,
        array $snapshot = [],
        ?int $actorId = null,
        string $assignmentType = 'auto',
    ): TripOrder {
        if (! $trip->isEditable()) {
            throw DistributionException::tripNotEditable($trip->status);
        }

        return DB::transaction(function () use ($trip, $orderId, $snapshot, $actorId, $assignmentType) {
            $existing = TripOrder::where('order_id', $orderId)->lockForUpdate()->first();

            if ($existing !== null) {
                $otherTrip = Trip::find($existing->trip_id);
                throw DistributionException::orderAlreadyOnAnotherTrip(
                    $otherTrip?->trip_number ?? (string) $existing->trip_id
                );
            }

            if ($trip->isAtCapacity()) {
                throw DistributionException::tripAtCapacity($trip->capacity);
            }

            $tripOrder = $trip->tripOrders()->create([
                'order_id' => $orderId,
                'zone_code_snapshot' => $snapshot['zone_code'] ?? null,
                'governorate_snapshot' => $snapshot['governorate'] ?? null,
                'assignment_type' => $assignmentType,
                'assigned_by' => $actorId,
                'assigned_at' => now(),
            ]);

            $this->syncOrdersCount($trip);

            return $tripOrder;
        });
    }

    public function removeOrder(Trip $trip, string $orderId): void
    {
        if (! $trip->isEditable()) {
            throw DistributionException::tripNotEditable($trip->status);
        }

        DB::transaction(function () use ($trip, $orderId) {
            $trip->tripOrders()->where('order_id', $orderId)->delete();
            $this->syncOrdersCount($trip);
        });
    }

    /** Move an order between trips atomically, so it is never on two or none. */
    public function moveOrder(Trip $from, Trip $to, string $orderId, ?int $actorId = null): TripOrder
    {
        if (! $from->isEditable()) {
            throw DistributionException::tripNotEditable($from->status);
        }
        if (! $to->isEditable()) {
            throw DistributionException::tripNotEditable($to->status);
        }

        return DB::transaction(function () use ($from, $to, $orderId, $actorId) {
            $existing = $from->tripOrders()->where('order_id', $orderId)->lockForUpdate()->first();

            if ($existing === null) {
                throw DistributionException::orderAlreadyOnAnotherTrip($to->trip_number);
            }

            if ($to->isAtCapacity()) {
                throw DistributionException::tripAtCapacity($to->capacity);
            }

            $snapshot = [
                'zone_code' => $existing->zone_code_snapshot,
                'governorate' => $existing->governorate_snapshot,
            ];

            $existing->delete();
            $this->syncOrdersCount($from);

            $moved = $to->tripOrders()->create([
                'order_id' => $orderId,
                'zone_code_snapshot' => $snapshot['zone_code'],
                'governorate_snapshot' => $snapshot['governorate'],
                'assignment_type' => 'manual',
                'assigned_by' => $actorId,
                'assigned_at' => now(),
            ]);

            $this->syncOrdersCount($to);

            return $moved;
        });
    }

    // ── Custody ───────────────────────────────────────────────────────────────

    /** @param array<string, mixed> $attributes */
    public function addCustody(Trip $trip, array $attributes, ?int $actorId = null): TripCustody
    {
        if (! $trip->isEditable()) {
            throw DistributionException::tripNotEditable($trip->status);
        }

        return $trip->custodyItems()->create($attributes + ['created_by' => $actorId]);
    }

    public function confirmCustody(TripCustody $item, int $receivedQuantity, ?int $actorId = null): TripCustody
    {
        $item->update([
            'received_quantity' => $receivedQuantity,
            'is_driver_confirmed' => true,
            'driver_confirmed_at' => now(),
            'driver_confirmed_by' => $actorId,
        ]);

        return $item->refresh();
    }

    // ── Driver acceptance ─────────────────────────────────────────────────────

    /**
     * Record the driver's three confirmations. Any shortfall flags a discrepancy
     * so the dispatch gate can surface it rather than silently proceeding.
     */
    public function recordDriverAcceptance(
        Trip $trip,
        bool $products,
        bool $custody,
        bool $equipment,
        ?string $discrepancyNotes = null,
        ?int $actorId = null,
    ): Trip {
        $hasDiscrepancy = ! ($products && $custody && $equipment)
            || $trip->custodyItems->contains(fn (TripCustody $c) => $c->hasShortfall());

        $trip->update([
            'driver_accepted_products' => $products,
            'driver_accepted_custody' => $custody,
            'driver_accepted_equipment' => $equipment,
            'driver_acceptance_at' => now(),
            'driver_acceptance_by' => $actorId,
            'has_discrepancy' => $hasDiscrepancy,
            'discrepancy_notes' => $discrepancyNotes,
        ]);

        return $trip->refresh();
    }

    /** Link an approved driver/vehicle pairing to the trip. */
    public function assignDriverVehicle(Trip $trip, int $assignmentId): Trip
    {
        $assignment = DriverVehicleAssignment::findOrFail($assignmentId);

        if (! $assignment->isActive()) {
            throw DistributionException::assignmentNotActive();
        }

        $trip->update(['driver_vehicle_assignment_id' => $assignment->id]);

        return $trip->refresh();
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function syncOrdersCount(Trip $trip): void
    {
        $trip->update(['orders_count' => $trip->tripOrders()->count()]);
    }

    /** Sequential per company: TRP-001, TRP-002, … */
    public function nextTripNumber(?string $companyId): string
    {
        $max = Trip::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->where('trip_number', 'like', 'TRP-%')
            ->pluck('trip_number')
            ->map(static fn (string $n) => (int) substr($n, 4))
            ->max() ?? 0;

        return sprintf('TRP-%03d', $max + 1);
    }
}
