<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Presentation\Http\Resources;

use BackedEnum;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class LoadingSessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'session_number' => $this->session_number,
            'status' => $this->status instanceof BackedEnum ? $this->status->value : $this->status,
            'session_type' => $this->session_type instanceof BackedEnum ? $this->session_type->value : $this->session_type,
            'warehouse_id' => $this->warehouse_id,
            'operational_date' => $this->operational_date?->toDateString(),
            'vehicles_count' => $this->vehicles_count,
            'orders_count' => $this->orders_count,
            'products_count' => $this->products_count,
            'total_units_to_load' => (float) $this->total_units_to_load,
            'total_units_loaded' => (float) $this->total_units_loaded,
            'loading_pct' => $this->total_units_to_load > 0
                ? round(($this->total_units_loaded / $this->total_units_to_load) * 100, 1)
                : 0.0,
            'loading_started_at' => $this->loading_started_at?->toIso8601String(),
            'loading_completed_at' => $this->loading_completed_at?->toIso8601String(),
            'dispatched_at' => $this->dispatched_at?->toIso8601String(),
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'cancellation_reason' => $this->cancellation_reason,
            'notes' => $this->notes,
            'created_at' => $this->created_at?->toIso8601String(),
            'created_by' => $this->created_by,
            // Conditional relationships
            'vehicle_assignments' => $this->whenLoaded('vehicleAssignments', fn () => VehicleAssignmentResource::collection($this->vehicleAssignments)),
            'loading_exceptions' => $this->whenLoaded('loadingExceptions', fn () => LoadingExceptionResource::collection($this->loadingExceptions)),
        ];
    }
}
