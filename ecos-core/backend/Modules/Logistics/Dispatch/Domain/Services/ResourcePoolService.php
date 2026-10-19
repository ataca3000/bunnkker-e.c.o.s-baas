<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Services;

use Modules\Logistics\Drivers\Domain\Models\Driver;
use Modules\Logistics\Fleet\Domain\Contracts\FleetReadinessQueryInterface;
use Modules\Logistics\Fleet\Domain\ValueObjects\FitnessVerdict;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;

/**
 * The resources available to a board at a moment.
 *
 * ┌─ DIRECTIVE 5 — DISPATCH CONSUMES FLEET, NEVER ITS INTERNALS ────────────┐
 * │ The ONLY Fleet symbol this class knows is FleetReadinessQueryInterface   │
 * │ and the FitnessVerdict it returns. It never touches a fleet_* table, a   │
 * │ Fleet model, or FleetReadinessService directly.                          │
 * │                                                                          │
 * │ Fleet remains the readiness authority; Dispatch asks and obeys.          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Driver readiness is likewise delegated: Driver::canStartDeliveries() is
 * LOG-002's gate and Dispatch does not re-implement it.
 */
class ResourcePoolService
{
    public function __construct(
        private readonly FleetReadinessQueryInterface $fleetReadiness,
    ) {}

    /**
     * Vehicles and drivers a board may draw on, each with the verdict that
     * decided it.
     *
     * @return array{
     *     vehicles: list<array<string, mixed>>,
     *     drivers: list<array<string, mixed>>,
     *     assignable_vehicle_count: int,
     *     available_driver_count: int
     * }
     */
    public function build(?string $companyId = null): array
    {
        $vehicles = Vehicle::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->get();

        // ONE batched call, not one per vehicle. A 500-vehicle pool must not
        // become 500 round trips.
        $verdicts = $this->fleetReadiness->verdictForMany(
            $vehicles->pluck('id')->map(static fn ($id) => (int) $id)->all()
        );

        $vehicleRows = $vehicles->map(function (Vehicle $vehicle) use ($verdicts) {
            /** @var FitnessVerdict $verdict */
            $verdict = $verdicts[$vehicle->id] ?? FitnessVerdict::noOpinion();

            // Two independent gates, both owned elsewhere:
            //   • LOG-003's Vehicle::canBeDispatched() — operational status
            //   • Fleet's FitnessVerdict — condition
            // D2 left canBeDispatched() unmodified, so Dispatch is where the
            // two answers are combined.
            $v1Ready = $vehicle->canBeDispatched();

            return [
                'vehicle_id' => $vehicle->id,
                'uuid' => $vehicle->uuid,
                'plate_number' => $vehicle->plate_number,
                'capacity_orders' => $vehicle->capacity_orders,
                'v1_status' => $vehicle->status?->value,
                'v1_dispatchable' => $v1Ready,
                'fitness' => $verdict->toArray(),
                'is_assignable' => $v1Ready && $verdict->isAssignable(),
            ];
        })->values()->all();

        $drivers = Driver::query()
            ->when($companyId !== null, fn ($q) => $q->whereNull('id')->orWhereNotNull('id'))
            ->get()
            ->map(static fn (Driver $driver) => [
                'driver_id' => $driver->id,
                'driver_code' => $driver->driver_code,
                'full_name' => $driver->full_name,
                // LOG-002's own gate. Dispatch does not re-derive licence rules.
                'can_start_deliveries' => $driver->canStartDeliveries(),
            ])
            ->values()
            ->all();

        return [
            'vehicles' => $vehicleRows,
            'drivers' => $drivers,
            'assignable_vehicle_count' => count(array_filter(
                $vehicleRows,
                static fn (array $row) => $row['is_assignable'],
            )),
            'available_driver_count' => count(array_filter(
                $drivers,
                static fn (array $row) => $row['can_start_deliveries'],
            )),
        ];
    }

    /** Fitness for one vehicle, straight from Fleet's public interface. */
    public function fitnessFor(int $vehicleId): FitnessVerdict
    {
        return $this->fleetReadiness->verdictFor($vehicleId);
    }
}
