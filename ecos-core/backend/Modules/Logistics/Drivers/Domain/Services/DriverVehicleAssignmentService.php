<?php

declare(strict_types=1);

namespace Modules\Logistics\Drivers\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Logistics\Drivers\Domain\Exceptions\VehicleAssignmentException;
use Modules\Logistics\Drivers\Domain\Models\Driver;
use Modules\Logistics\Drivers\Domain\Models\DriverVehicleAssignment;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;
use Modules\Logistics\Vehicles\Domain\Services\VehicleService;

/**
 * Owns every transition of the driver↔vehicle pairing.
 *
 * Invariants (BR-6, BR-7) are guarded here for a clear error message and
 * backed by unique indexes in the database, so a race that slips past the
 * check still fails loudly instead of creating a second active row.
 */
class DriverVehicleAssignmentService
{
    public function __construct(
        private readonly VehicleService $vehicleService,
    ) {}

    /**
     * Assign a vehicle to a driver.
     *
     * This single operation covers both "Assign Vehicle" and "Change Vehicle":
     * if the driver already holds a vehicle it is released first, inside the
     * same transaction, so history stays continuous and the driver is never
     * momentarily attached to two vehicles.
     */
    public function assign(
        Driver $driver,
        Vehicle $vehicle,
        ?string $actor = null,
        ?string $notes = null,
    ): DriverVehicleAssignment {
        if ($driver->isArchived()) {
            throw VehicleAssignmentException::driverArchived();
        }

        // BR-3 / vehicle lifecycle: only a vehicle sitting in the pool may be
        // taken. Archived, in maintenance and out-of-service all fail here.
        // Re-assigning the driver's own current vehicle is handled below.
        if (! $vehicle->status->acceptsAssignment() && ! $vehicle->hasActiveDriver()) {
            throw VehicleAssignmentException::vehicleUnavailable($vehicle->plate_number);
        }

        return DB::transaction(function () use ($driver, $vehicle, $actor, $notes) {
            // Lock the candidate rows so two concurrent assignments serialise.
            $held = DriverVehicleAssignment::whereNotNull('active_flag')
                ->where(function ($q) use ($driver, $vehicle) {
                    $q->where('driver_id', $driver->id)
                        ->orWhere('vehicle_id', $vehicle->id);
                })
                ->lockForUpdate()
                ->get();

            $vehicleTaken = $held->firstWhere(
                fn (DriverVehicleAssignment $a) => $a->vehicle_id === $vehicle->id
                    && $a->driver_id !== $driver->id
            );

            if ($vehicleTaken !== null) {
                $other = Driver::find($vehicleTaken->driver_id);
                throw VehicleAssignmentException::vehicleTaken(
                    $vehicle->plate_number,
                    $other?->full_name ?? 'another driver'
                );
            }

            $current = $held->firstWhere(
                fn (DriverVehicleAssignment $a) => $a->driver_id === $driver->id
            );

            if ($current !== null && $current->vehicle_id === $vehicle->id) {
                throw VehicleAssignmentException::alreadyAssignedToSameVehicle($vehicle->plate_number);
            }

            // "Change Vehicle" — close the outgoing pairing first, and hand the
            // outgoing vehicle back to the pool so its status stays truthful.
            if ($current !== null) {
                $this->closeAssignment($current, $actor, 'Replaced by a new vehicle assignment.');
                $outgoing = Vehicle::find($current->vehicle_id);
                if ($outgoing !== null) {
                    $this->vehicleService->markReleased($outgoing, $actor);
                }
            }

            $assignment = DriverVehicleAssignment::create([
                'driver_id' => $driver->id,
                'vehicle_id' => $vehicle->id,
                'assigned_at' => now(),
                'active_flag' => DriverVehicleAssignment::ACTIVE,
                'assigned_by' => $actor,
                'notes' => $notes,
            ]);

            // Reflect the pairing on the vehicle lifecycle (Available → Assigned).
            $this->vehicleService->markAssigned($vehicle->refresh(), $actor);

            return $assignment;
        });
    }

    /**
     * Release the driver's current vehicle, leaving them unassigned.
     */
    public function release(
        Driver $driver,
        ?string $actor = null,
        ?string $reason = null,
    ): DriverVehicleAssignment {
        return DB::transaction(function () use ($driver, $actor, $reason) {
            $current = DriverVehicleAssignment::where('driver_id', $driver->id)
                ->whereNotNull('active_flag')
                ->lockForUpdate()
                ->first();

            if ($current === null) {
                throw VehicleAssignmentException::noActiveAssignment();
            }

            $this->closeAssignment($current, $actor, $reason);

            $vehicle = Vehicle::find($current->vehicle_id);
            if ($vehicle !== null) {
                $this->vehicleService->markReleased($vehicle, $actor);
            }

            return $current->refresh();
        });
    }

    /**
     * Stamp an assignment as finished. Clearing active_flag to NULL is what
     * frees both the driver and the vehicle under the unique indexes.
     */
    private function closeAssignment(
        DriverVehicleAssignment $assignment,
        ?string $actor,
        ?string $reason,
    ): void {
        $assignment->update([
            'released_at' => now(),
            'active_flag' => null,
            'released_by' => $actor,
            'release_reason' => $reason,
        ]);
    }
}
