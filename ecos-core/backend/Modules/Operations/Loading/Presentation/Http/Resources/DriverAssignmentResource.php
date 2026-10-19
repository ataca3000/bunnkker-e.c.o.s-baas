<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Presentation\Http\Resources;

use BackedEnum;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class DriverAssignmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status instanceof BackedEnum ? $this->status->value : $this->status,
            'assignment_type' => $this->assignment_type instanceof BackedEnum ? $this->assignment_type->value : $this->assignment_type,
            'vehicle_assignment_id' => $this->vehicle_assignment_id,
            'vehicle_id' => $this->vehicle_id,
            'driver_id' => $this->driver_id,
            'driver_name_snapshot' => $this->driver_name_snapshot,
            'assigned_at' => $this->assigned_at?->toIso8601String(),
            'departure_time_planned' => $this->departure_time_planned?->toIso8601String(),
            'departure_time_actual' => $this->departure_time_actual?->toIso8601String(),
            'return_time_actual' => $this->return_time_actual?->toIso8601String(),
        ];
    }
}
