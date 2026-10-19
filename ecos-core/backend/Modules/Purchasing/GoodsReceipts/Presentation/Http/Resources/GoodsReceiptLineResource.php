<?php

declare(strict_types=1);

namespace Modules\Purchasing\GoodsReceipts\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceiptLine;

/**
 * @mixin GoodsReceiptLine
 */
final class GoodsReceiptLineResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $netQty = (float) ($this->net_received_quantity ?? $this->received_quantity ?? 0);
        $grossQty = (float) ($this->gross_received_quantity ?? $netQty);
        $orderedQty = (float) $this->ordered_quantity;

        return [
            'id' => $this->id,
            'purchase_order_line_id' => $this->purchase_order_line_id,
            'product_id' => $this->product_id,
            'product' => $this->whenLoaded('product', fn () => [
                'id' => $this->product->id,
                'sku' => $this->product->sku,
                'name' => $this->product->name,
            ]),

            // UOM snapshot
            'uom_id_snapshot' => $this->uom_id_snapshot,
            'uom_name_snapshot' => $this->uom_name_snapshot,
            'uom_symbol_snapshot' => $this->uom_symbol_snapshot,

            // Quantity columns
            'ordered_quantity' => $orderedQty,
            'gross_received_quantity' => $grossQty,
            'net_received_quantity' => $netQty,
            'variance_quantity' => round($netQty - $orderedQty, 4),
            'remaining_quantity' => round(max(0.0, $orderedQty - $netQty), 4),

            // Pricing
            'unit_price' => (float) $this->unit_price,
            'landed_unit_cost' => $this->landed_unit_cost !== null
                ? (float) $this->landed_unit_cost
                : null,

            // Evidence
            'weight_photo_path' => $this->weight_photo_path,
            'weight_photo_url' => $this->weight_photo_path
                ? Storage::url($this->weight_photo_path)
                : null,
            'notes' => $this->notes,
        ];
    }
}
