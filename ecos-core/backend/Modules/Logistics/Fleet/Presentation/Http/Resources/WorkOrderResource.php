<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Fleet\Domain\Models\WorkOrder;

/**
 * @mixin WorkOrder
 */
class WorkOrderResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->uuid,
            'uuid' => $this->uuid,
            'fleet_unit_id' => $this->fleet_unit_id,
            'maintenance_plan_id' => $this->maintenance_plan_id,

            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'is_open' => $this->isOpen(),
            'allowed_transitions' => array_map(
                static fn ($s) => ['value' => $s->value, 'label' => $s->label()],
                $this->status->allowedTransitions(),
            ),

            'maintenance_type' => $this->maintenance_type,
            'kind' => $this->kind,
            'description' => $this->description,
            'is_immobilising' => $this->is_immobilising,

            'scheduled_for' => $this->scheduled_for?->toDateString(),
            'vendor' => $this->vendor,
            'started_at' => $this->started_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'duration_hours' => $this->durationHours(),

            'odometer_at_start_km' => $this->odometer_at_start_km !== null
                ? (float) $this->odometer_at_start_km
                : null,
            'odometer_at_completion_km' => $this->odometer_at_completion_km !== null
                ? (float) $this->odometer_at_completion_km
                : null,
            'distance_km' => $this->distanceKm(),

            'cost' => $this->cost !== null ? (float) $this->cost : null,
            'currency' => $this->currency,

            // Receipt from LOG-003's VehicleMaintenanceService — proof the V1
            // boundary was crossed through the service rather than around it.
            'v1_maintenance_record_id' => $this->v1_maintenance_record_id,
            'is_mirrored_to_v1' => $this->isMirroredToV1(),

            'cancellation_reason' => $this->cancellation_reason,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
