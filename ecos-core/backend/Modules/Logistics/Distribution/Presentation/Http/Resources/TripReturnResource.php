<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Distribution\Domain\Models\TripReturn;

/**
 * @mixin TripReturn
 */
class TripReturnResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'trip_id' => $this->trip_id,
            'kind' => $this->kind->value,
            'kind_label' => $this->kind->label(),

            // Product returns
            'order_id' => $this->order_id,
            'product_id' => $this->product_id,
            'product_name' => $this->product_name,
            'disposition' => $this->disposition,

            // Custody returns
            'custody_type' => $this->custody_type,

            // Shared reconciliation
            'dispatched_qty' => (float) $this->dispatched_qty,
            'returned_qty' => (float) $this->returned_qty,
            'warehouse_confirmed_qty' => $this->warehouse_confirmed_qty !== null
                ? (float) $this->warehouse_confirmed_qty
                : null,
            'warehouse_confirmed_at' => $this->warehouse_confirmed_at?->toIso8601String(),
            'discrepancy_qty' => $this->discrepancy_qty !== null ? (float) $this->discrepancy_qty : null,
            'has_discrepancy' => $this->hasDiscrepancy(),
            'is_confirmed' => $this->isConfirmed(),
            'driver_liable' => $this->driver_liable,

            'reason' => $this->reason,
            'photos' => $this->photos ?? [],
            'notes' => $this->notes,
            'reported_by' => $this->reported_by,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
