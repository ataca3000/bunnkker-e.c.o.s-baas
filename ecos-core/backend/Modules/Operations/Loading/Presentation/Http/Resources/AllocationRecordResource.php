<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Presentation\Http\Resources;

use BackedEnum;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class AllocationRecordResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status instanceof BackedEnum ? $this->status->value : $this->status,
            'order_id' => $this->order_id,
            'order_number_snapshot' => $this->order_number_snapshot,
            'product_id' => $this->product_id,
            'sku_snapshot' => $this->sku_snapshot,
            'quantity_requested' => (float) $this->quantity_requested,
            'quantity_allocated' => (float) $this->quantity_allocated,
            'quantity_delivered' => (float) $this->quantity_delivered,
            'quantity_remaining' => (float) $this->quantity_remaining,
            'is_partial' => (bool) $this->is_partial,
            'partial_reason' => $this->partial_reason,
            'allocation_mode' => $this->allocation_mode instanceof BackedEnum ? $this->allocation_mode->value : $this->allocation_mode,
            'priority_rank' => $this->priority_rank,
            'allocated_at' => $this->allocated_at?->toIso8601String(),
            'allocated_by' => $this->allocated_by,
            'decisions_count' => $this->whenLoaded('decisions', fn () => $this->decisions->count()),
        ];
    }
}
