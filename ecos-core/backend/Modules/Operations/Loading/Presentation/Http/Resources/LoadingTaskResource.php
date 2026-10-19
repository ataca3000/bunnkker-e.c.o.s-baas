<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Presentation\Http\Resources;

use BackedEnum;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class LoadingTaskResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status instanceof BackedEnum ? $this->status->value : $this->status,
            'vehicle_assignment_id' => $this->vehicle_assignment_id,
            'product_id' => $this->product_id,
            'sku_snapshot' => $this->sku_snapshot,
            'name_snapshot' => $this->name_snapshot,
            'quantity_planned' => (float) $this->quantity_planned,
            'quantity_loaded' => (float) $this->quantity_loaded,
            'quantity_short' => (float) $this->quantity_short,
            'requires_refrigeration' => (bool) $this->requires_refrigeration,
            'loaded_at' => $this->loaded_at?->toIso8601String(),
            'loaded_by' => $this->loaded_by,
            'confirmed_at' => $this->confirmed_at?->toIso8601String(),
            'confirmed_by' => $this->confirmed_by,
            'short_reason' => $this->short_reason,
            'notes' => $this->notes,
        ];
    }
}
