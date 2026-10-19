<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \Modules\Purchasing\PurchaseMaterials\Domain\Models\PurchaseMaterialLine */
class PurchaseMaterialLineResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'product' => $this->whenLoaded('product', fn () => [
                'id' => $this->product->id,
                'sku' => $this->product->sku,
                'name' => $this->product->name,
                'image_url' => $this->product->image_url ?? null,
                'average_cost' => $this->product->average_cost,
            ]),
            'requested_qty' => (float) $this->requested_qty,
            'unit_label' => $this->unit_label,
            'notes' => $this->notes,
            'supplier_id' => $this->supplier_id,
            'supplier' => $this->whenLoaded('supplier', fn () => $this->supplier ? [
                'id' => $this->supplier->id,
                'name' => $this->supplier->name,
            ] : null),
            'agreed_price' => $this->agreed_price !== null ? (float) $this->agreed_price : null,
            'agreed_qty' => $this->agreed_qty !== null ? (float) $this->agreed_qty : null,
            'lead_time_days' => $this->lead_time_days,
            'supplier_selected_at' => $this->supplier_selected_at?->toIso8601String(),
        ];
    }
}
