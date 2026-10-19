<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Presentation\Http\Resources;

use BackedEnum;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class VehiclePlanSlotResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slot_number' => $this->slot_number,
            'vehicle_id' => $this->vehicle_id,
            'status' => $this->status instanceof BackedEnum ? $this->status->value : $this->status,
            'orders_count' => $this->orders_count,
            'weight_kg' => (float) $this->weight_kg,
            'volume_m3' => (float) $this->volume_m3,
        ];
    }
}
