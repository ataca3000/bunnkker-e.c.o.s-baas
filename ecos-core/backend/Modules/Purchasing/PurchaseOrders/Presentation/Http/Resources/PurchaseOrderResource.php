<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseOrders\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrder;

/**
 * @mixin PurchaseOrder
 */
final class PurchaseOrderResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $lines = $this->whenLoaded('lines');

        // Received % — computed from line-level received_qty vs quantity when lines are loaded.
        $receivedPct = null;
        if ($this->relationLoaded('lines') && $this->lines->isNotEmpty()) {
            $totalQty = $this->lines->sum(fn ($l) => (float) $l->quantity);
            $totalReceived = $this->lines->sum(fn ($l) => (float) $l->received_qty);
            $receivedPct = $totalQty > 0 ? round(($totalReceived / $totalQty) * 100, 1) : 0;
        }

        return [
            'id' => $this->id,
            'po_number' => $this->po_number,
            'supplier_id' => $this->supplier_id,
            'supplier' => $this->whenLoaded('supplier', fn () => [
                'id' => $this->supplier->id,
                'code' => $this->supplier->code,
                'name' => $this->supplier->name,
            ]),
            'warehouse_id' => $this->warehouse_id,
            'warehouse' => $this->whenLoaded('warehouse', fn () => [
                'id' => $this->warehouse->id,
                'code' => $this->warehouse->code,
                'name' => $this->warehouse->name,
            ]),
            'company_id' => $this->company_id,
            'supplier_reference' => $this->supplier_reference,
            'order_date' => $this->order_date?->toDateString(),
            'expected_date' => $this->expected_date?->toDateString(),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'notes' => $this->notes,
            'subtotal' => (float) $this->subtotal,
            'discount_amount' => (float) $this->discount_amount,
            'shipping_amount' => (float) $this->shipping_amount,
            'additional_costs' => (float) $this->additional_costs,
            'grand_total' => (float) $this->grand_total,
            'total' => (float) $this->total,
            'received_percentage' => $receivedPct,
            'created_by' => $this->created_by,
            'lines' => PurchaseOrderLineResource::collection($lines),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
