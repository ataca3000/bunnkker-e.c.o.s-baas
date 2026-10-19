<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Distribution\Domain\Models\Trip;

/**
 * @mixin Trip
 */
class TripResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $assignment = $this->whenLoaded('driverVehicleAssignment');

        return [
            // CTO decision: the UUID is the public identifier for a Trip.
            // The bigint primary key stays internal and is never exposed.
            'id' => $this->uuid,
            'uuid' => $this->uuid,
            'trip_number' => $this->trip_number,
            'name' => $this->name,

            'company_id' => $this->company_id,
            'preparation_wave_id' => $this->preparation_wave_id,
            'distribution_zone_id' => $this->distribution_zone_id,

            'type' => $this->type->value,
            'type_label' => $this->type->label(),
            'capacity' => $this->capacity,
            'orders_count' => $this->orders_count,
            'remaining_capacity' => $this->remainingCapacity(),

            // Resourcing — resolved from the referenced aggregates, never stored here.
            'shipping_company_id' => $this->shipping_company_id,
            'shipping_company_name' => $this->whenLoaded('shippingCompany', fn () => $this->shippingCompany?->name),
            'driver_vehicle_assignment_id' => $this->driver_vehicle_assignment_id,
            'driver' => $this->when(
                $this->relationLoaded('driverVehicleAssignment'),
                fn () => $this->driverVehicleAssignment?->driver
                    ? [
                        'id' => $this->driverVehicleAssignment->driver->id,
                        'driver_code' => $this->driverVehicleAssignment->driver->driver_code,
                        'full_name' => $this->driverVehicleAssignment->driver->full_name,
                        'mobile' => $this->driverVehicleAssignment->driver->mobile,
                        'license_status' => $this->driverVehicleAssignment->driver->licenseStatus(),
                    ]
                    : null
            ),
            'vehicle' => $this->when(
                $this->relationLoaded('driverVehicleAssignment'),
                fn () => $this->driverVehicleAssignment?->vehicle
                    ? [
                        'id' => $this->driverVehicleAssignment->vehicle->id,
                        'vehicle_code' => $this->driverVehicleAssignment->vehicle->vehicle_code,
                        'plate_number' => $this->driverVehicleAssignment->vehicle->plate_number,
                        'label' => $this->driverVehicleAssignment->vehicle->label(),
                        'status' => $this->driverVehicleAssignment->vehicle->status->value,
                    ]
                    : null
            ),

            // Lifecycle
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'allowed_transitions' => array_map(
                static fn ($s) => ['value' => $s->value, 'label' => $s->label()],
                $this->status->allowedTransitions(),
            ),
            'is_editable' => $this->isEditable(),
            'is_terminal' => $this->isTerminal(),

            // Dispatch readiness — delegated to the owning aggregates
            'dispatch_blockers' => $this->when(
                $this->relationLoaded('driverVehicleAssignment'),
                fn () => $this->dispatchBlockers()
            ),
            'is_ready_for_dispatch' => $this->when(
                $this->relationLoaded('driverVehicleAssignment'),
                fn () => $this->isReadyForDispatch()
            ),

            // Driver acceptance
            'driver_accepted_products' => $this->driver_accepted_products,
            'driver_accepted_custody' => $this->driver_accepted_custody,
            'driver_accepted_equipment' => $this->driver_accepted_equipment,
            'has_full_driver_acceptance' => $this->hasFullDriverAcceptance(),
            'driver_acceptance_at' => $this->driver_acceptance_at?->toIso8601String(),
            'has_discrepancy' => $this->has_discrepancy,
            'discrepancy_notes' => $this->discrepancy_notes,

            // Timeline
            'finalized_at' => $this->finalized_at?->toIso8601String(),
            'dispatched_at' => $this->dispatched_at?->toIso8601String(),
            'driver_notified_at' => $this->driver_notified_at?->toIso8601String(),
            'departure_at' => $this->departure_at?->toIso8601String(),
            'trip_started_at' => $this->trip_started_at?->toIso8601String(),
            'trip_finished_at' => $this->trip_finished_at?->toIso8601String(),
            'odometer_start' => $this->odometer_start,
            'odometer_end' => $this->odometer_end,

            // Money (authoritative figures live in the settlement)
            'collection_amount' => (float) $this->collection_amount,
            'total_cash_collected' => (float) $this->total_cash_collected,
            'total_bank_transfers' => (float) $this->total_bank_transfers,
            'total_already_paid' => (float) $this->total_already_paid,

            'notes' => $this->notes,

            'trip_orders_count' => $this->whenCounted('tripOrders'),
            'stops_count' => $this->whenCounted('stops'),
            'custody_count' => $this->whenCounted('custodyItems'),
            'exceptions_count' => $this->whenCounted('exceptions'),

            'trip_orders' => TripOrderResource::collection($this->whenLoaded('tripOrders')),
            'custody_items' => TripCustodyResource::collection($this->whenLoaded('custodyItems')),
            'stops' => DeliveryStopResource::collection($this->whenLoaded('stops')),
            'exceptions' => DeliveryExceptionResource::collection($this->whenLoaded('exceptions')),
            'returns' => TripReturnResource::collection($this->whenLoaded('returns')),
            'settlement' => new TripSettlementResource($this->whenLoaded('settlement')),

            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
