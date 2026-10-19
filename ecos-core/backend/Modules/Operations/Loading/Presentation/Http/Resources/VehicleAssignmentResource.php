<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Presentation\Http\Resources;

use BackedEnum;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class VehicleAssignmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'assignment_number' => $this->assignment_number,
            'status' => $this->status instanceof BackedEnum ? $this->status->value : $this->status,
            'vehicle_id' => $this->vehicle_id,
            'vehicle_registration_snapshot' => $this->vehicle_registration_snapshot,
            'vehicle_type_snapshot' => $this->vehicle_type_snapshot,
            'capacity_weight_kg_snapshot' => (float) $this->capacity_weight_kg_snapshot,
            'capacity_volume_m3_snapshot' => (float) $this->capacity_volume_m3_snapshot,
            'refrigerated_snapshot' => (bool) $this->refrigerated_snapshot,
            'orders_count' => $this->orders_count,
            'loading_weight_kg' => (float) $this->loading_weight_kg,
            'loading_volume_m3' => (float) $this->loading_volume_m3,
            'loading_started_at' => $this->loading_started_at?->toIso8601String(),
            'loading_completed_at' => $this->loading_completed_at?->toIso8601String(),
            'dispatched_at' => $this->dispatched_at?->toIso8601String(),
            'returned_at' => $this->returned_at?->toIso8601String(),
            'reconciled_at' => $this->reconciled_at?->toIso8601String(),
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'cancellation_reason' => $this->cancellation_reason,
            'loading_tasks' => $this->whenLoaded('loadingTasks', fn () => LoadingTaskResource::collection($this->loadingTasks)),
            'driver_assignment' => $this->whenLoaded('driverAssignment', fn () => $this->driverAssignment ? new DriverAssignmentResource($this->driverAssignment) : null),
        ];
    }
}
