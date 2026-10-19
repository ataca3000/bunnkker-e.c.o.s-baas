<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseOrders\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrderLine;

/**
 * @mixin PurchaseOrderLine
 */
final class PurchaseOrderLineResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'product' => $this->whenLoaded('product', fn () => [
                'id' => $this->product->id,
                'sku' => $this->product->sku,
                'name' => $this->product->name,
            ]),
            'quantity' => (float) $this->quantity,
            'received_qty' => (float) $this->received_qty,
            'remaining_qty' => $this->remainingQty(),
            'unit_price' => (float) $this->unit_price,
            'line_total' => (float) $this->line_total,
        ];
    }
}
