<?php

declare(strict_types=1);

namespace Modules\Logistics\Vehicles\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Vehicles\Domain\Models\VehicleMaintenanceRecord;

/**
 * @mixin VehicleMaintenanceRecord
 */
class VehicleMaintenanceRecordResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'vehicle_id' => $this->vehicle_id,
            'performed_on' => $this->performed_on?->format('Y-m-d'),
            'type' => $this->type->value,
            'type_label' => $this->type->label(),
            'description' => $this->description,
            'cost' => (float) $this->cost,
            'currency' => $this->currency,
            'vendor' => $this->vendor,
            'next_maintenance_date' => $this->next_maintenance_date?->format('Y-m-d'),
            'is_next_service_due' => $this->isNextServiceDue(),
            'notes' => $this->notes,
            'recorded_by' => $this->recorded_by,
            'was_amended' => $this->wasAmended(),
            'amended_by' => $this->amended_by,
            'amended_at' => $this->amended_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
