<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Presentation\Http\Resources;

use BackedEnum;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class VehicleInventoryItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'sku_snapshot' => $this->sku_snapshot,
            'name_snapshot' => $this->name_snapshot,
            'status' => $this->status instanceof BackedEnum ? $this->status->value : $this->status,
            'quantity_loaded' => (float) $this->quantity_loaded,
            'quantity_allocated' => (float) $this->quantity_allocated,
            'quantity_delivered' => (float) $this->quantity_delivered,
            'quantity_returned' => (float) $this->quantity_returned,
            'quantity_on_hand' => (float) $this->quantity_on_hand,
            'quantity_unallocated' => (float) $this->quantity_unallocated,
            'operational_date' => $this->operational_date?->toDateString(),
            'last_movement_at' => $this->last_movement_at?->toIso8601String(),
        ];
    }
}
