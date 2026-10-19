<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Distribution\Domain\Models\TripCustody;

/**
 * @mixin TripCustody
 */
class TripCustodyResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'trip_id' => $this->trip_id,
            'item_type' => $this->item_type->value,
            'item_type_label' => $this->item_type->label(),
            'description' => $this->description,
            'quantity' => $this->quantity,
            'received_quantity' => $this->received_quantity,
            'has_shortfall' => $this->hasShortfall(),
            'shortfall_quantity' => $this->shortfallQuantity(),
            'is_driver_confirmed' => $this->is_driver_confirmed,
            'driver_confirmed_at' => $this->driver_confirmed_at?->toIso8601String(),
            'notes' => $this->notes,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
