<?php

declare(strict_types=1);

namespace Modules\Logistics\Vehicles\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Logistics\Vehicles\Domain\Contracts\VehicleRepositoryInterface;
use Modules\Logistics\Vehicles\Domain\Enums\VehicleStatus;
use Modules\Logistics\Vehicles\Domain\Events\VehicleCreated;
use Modules\Logistics\Vehicles\Domain\Events\VehicleStatusChanged;
use Modules\Logistics\Vehicles\Domain\Exceptions\VehicleException;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;

/**
 * Owns every vehicle lifecycle decision.
 *
 * Controllers validate shape; this service decides whether a transition is
 * legal and emits the domain events other contexts subscribe to.
 */
class VehicleService
{
    public function __construct(
        private readonly VehicleRepositoryInterface $vehicles,
    ) {}

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes, ?string $actor = null): Vehicle
    {
        $vehicle = DB::transaction(fn () => $this->vehicles->create($attributes));

        VehicleCreated::dispatch($vehicle, $actor);

        return $vehicle;
    }

    /** @param array<string, mixed> $attributes */
    public function update(Vehicle $vehicle, array $attributes, ?string $actor = null): Vehicle
    {
        // Status is never changed through the generic update path — it must go
        // through changeStatus() so the transition table is always consulted.
        unset($attributes['status']);

        return DB::transaction(fn () => $this->vehicles->update($vehicle, $attributes));
    }

    /**
     * Move a vehicle between lifecycle states.
     *
     * Enforces three things in order: the target must be operator-settable,
     * the transition must appear in VehicleStatus's map (BR-4), and a vehicle
     * still holding a driver may not be declared Available (BR-4).
     */
    public function changeStatus(
        Vehicle $vehicle,
        VehicleStatus $target,
        ?string $reason = null,
        ?string $actor = null,
    ): Vehicle {
        $current = $vehicle->status;

        if ($current === $target) {
            return $vehicle;
        }

        if (! in_array($target, VehicleStatus::operatorSettable(), true)) {
            throw VehicleException::statusNotOperatorSettable($target);
        }

        if (! $current->canTransitionTo($target)) {
            throw VehicleException::invalidTransition($current, $target);
        }

        if ($target === VehicleStatus::Available && $vehicle->hasActiveDriver()) {
            throw VehicleException::availableWhileDriverAssigned();
        }

        $updated = DB::transaction(
            fn () => $this->vehicles->update($vehicle, ['status' => $target->value])
        );

        VehicleStatusChanged::dispatch($updated, $current, $target, $reason, $actor);

        return $updated;
    }

    /**
     * Reflect a driver assignment on the vehicle.
     *
     * Called by the Drivers module after it has already enforced BR-5/BR-7 on
     * the assignment ledger. Assigned and InDelivery are derived states, so
     * they are set here rather than through changeStatus().
     */
    public function markAssigned(Vehicle $vehicle, ?string $actor = null): Vehicle
    {
        if ($vehicle->status !== VehicleStatus::Available) {
            return $vehicle;
        }

        $updated = $this->vehicles->update($vehicle, ['status' => VehicleStatus::Assigned->value]);

        VehicleStatusChanged::dispatch(
            $updated,
            VehicleStatus::Available,
            VehicleStatus::Assigned,
            'Driver assigned.',
            $actor,
        );

        return $updated;
    }

    /** Return a vehicle to the pool once its driver is released. */
    public function markReleased(Vehicle $vehicle, ?string $actor = null): Vehicle
    {
        if (! $vehicle->status->isEngaged()) {
            return $vehicle;
        }

        $from = $vehicle->status;
        $updated = $this->vehicles->update($vehicle, ['status' => VehicleStatus::Available->value]);

        VehicleStatusChanged::dispatch(
            $updated,
            $from,
            VehicleStatus::Available,
            'Driver released.',
            $actor,
        );

        return $updated;
    }

    /** BR-3 — guard used by the Drivers module before pairing. */
    public function assertCanReceiveAssignment(Vehicle $vehicle): void
    {
        if ($vehicle->isArchived()) {
            throw VehicleException::archivedCannotBeAssigned($vehicle->plate_number);
        }
    }
}
