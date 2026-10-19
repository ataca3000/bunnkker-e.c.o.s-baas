<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Fleet\Domain\Models\FleetUnit;
use Modules\Logistics\Fleet\Domain\Services\FleetReadinessService;

/**
 * @mixin FleetUnit
 *
 * The UUID is the public identifier, matching the Trip (LOG-004B) and Delivery
 * (LOG-005) convention.
 *
 * Vehicle identity is EXPOSED but not OWNED — every field under `vehicle` comes
 * from logistics_vehicles through the relation, which is the whole point of
 * Directive 2.
 */
class FleetUnitResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $verdict = app(FleetReadinessService::class)->verdict($this->resource);

        return [
            'id' => $this->uuid,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,

            // Read-only projection of the V1 vehicle. Fleet stores none of this.
            'vehicle_id' => $this->vehicle_id,
            'vehicle' => $this->whenLoaded('vehicle', fn () => [
                'id' => $this->vehicle->id,
                'uuid' => $this->vehicle->uuid,
                'vehicle_code' => $this->vehicle->vehicle_code,
                'plate_number' => $this->vehicle->plate_number,
                'name' => $this->vehicle->name,
                'type' => $this->vehicle->type?->value,
                'status' => $this->vehicle->status?->value,
                'fuel_type' => $this->vehicle->fuel_type?->value,
                'capacity_orders' => $this->vehicle->capacity_orders,
            ]),

            'lifecycle_state' => $this->lifecycle_state->value,
            'lifecycle_label' => $this->lifecycle_state->label(),
            'lifecycle_tone' => $this->lifecycle_state->tone(),
            'lifecycle_reason' => $this->lifecycle_reason,
            'allowed_transitions' => array_map(
                static fn ($s) => ['value' => $s->value, 'label' => $s->label()],
                $this->lifecycle_state->allowedTransitions(),
            ),

            // The verdict, with its ordered reasons — a screen that says "unfit"
            // must be able to say why in the same response.
            'fitness' => $verdict->toArray(),

            'current_odometer_km' => $this->current_odometer_km !== null
                ? (float) $this->current_odometer_km
                : null,
            'odometer_updated_at' => $this->odometer_updated_at?->toIso8601String(),

            'group' => $this->whenLoaded('group', fn () => [
                'id' => $this->group->uuid,
                'code' => $this->group->code,
                'name' => $this->group->name,
                'fleet' => $this->group->relationLoaded('fleet') && $this->group->fleet
                    ? [
                        'id' => $this->group->fleet->uuid,
                        'name' => $this->group->fleet->name,
                        'is_own_fleet' => $this->group->fleet->isOwnFleet(),
                    ]
                    : null,
            ]),

            'open_defect_count' => $this->when(
                $this->open_defect_count !== null,
                fn () => (int) $this->open_defect_count,
            ),
            'open_work_order_count' => $this->when(
                $this->open_work_order_count !== null,
                fn () => (int) $this->open_work_order_count,
            ),

            'acquisition_cost' => $this->acquisition_cost !== null
                ? (float) $this->acquisition_cost
                : null,
            'currency' => $this->currency,
            'acquisition_date' => $this->acquisition_date?->toDateString(),
            'monthly_depreciation' => $this->monthlyDepreciation(),

            'commissioned_at' => $this->commissioned_at?->toIso8601String(),
            'retired_at' => $this->retired_at?->toIso8601String(),
            'notes' => $this->notes,

            'maintenance_plans' => MaintenancePlanResource::collection(
                $this->whenLoaded('maintenancePlans')
            ),
            'defects' => DefectResource::collection($this->whenLoaded('defects')),
            'work_orders' => WorkOrderResource::collection($this->whenLoaded('workOrders')),

            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
