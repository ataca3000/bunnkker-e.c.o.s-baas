<?php

declare(strict_types=1);

namespace Modules\Logistics\Drivers\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Drivers\Domain\Models\DriverVehicleAssignment;
use Modules\Logistics\Vehicles\Presentation\Http\Resources\VehicleResource;

/**
 * @mixin DriverVehicleAssignment
 */
class DriverVehicleAssignmentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'driver_id' => $this->driver_id,
            'vehicle_id' => $this->vehicle_id,
            'vehicle' => new VehicleResource($this->whenLoaded('vehicle')),
            'vehicle_plate' => $this->whenLoaded('vehicle', fn () => $this->vehicle?->plate_number),
            'vehicle_label' => $this->whenLoaded('vehicle', fn () => $this->vehicle?->label()),
            'assigned_at' => $this->assigned_at?->toIso8601String(),
            'released_at' => $this->released_at?->toIso8601String(),
            'is_active' => $this->isActive(),
            'duration_days' => $this->durationDays(),
            'assigned_by' => $this->assigned_by,
            'released_by' => $this->released_by,
            'release_reason' => $this->release_reason,
            'notes' => $this->notes,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
