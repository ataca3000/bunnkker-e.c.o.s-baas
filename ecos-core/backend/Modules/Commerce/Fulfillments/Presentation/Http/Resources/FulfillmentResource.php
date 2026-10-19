<?php

declare(strict_types=1);

namespace Modules\Commerce\Fulfillments\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Commerce\Fulfillments\Domain\Models\Fulfillment;
use Modules\Commerce\Fulfillments\Domain\Models\FulfillmentLine;

/**
 * @mixin Fulfillment
 */
final class FulfillmentResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'fulfillment_number' => $this->fulfillment_number,
            'order_id' => $this->order_id,
            'order' => $this->whenLoaded('order', fn () => [
                'id' => $this->order->id,
                'order_number' => $this->order->order_number,
                'customer' => $this->order->relationLoaded('customer') ? [
                    'id' => $this->order->customer?->id,
                    'name' => $this->order->customer?->name,
                ] : null,
                'channel' => $this->order->relationLoaded('channel') ? [
                    'id' => $this->order->channel?->id,
                    'name' => $this->order->channel?->name,
                ] : null,
            ]),
            'warehouse_id' => $this->warehouse_id,
            'warehouse' => $this->whenLoaded('warehouse', fn () => [
                'id' => $this->warehouse->id,
                'code' => $this->warehouse->code,
                'name' => $this->warehouse->name,
            ]),
            'fulfillment_date' => $this->fulfillment_date?->toDateString(),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'notes' => $this->notes,
            'lines' => $this->whenLoaded('lines', function () {
                return $this->lines->map(fn (FulfillmentLine $line) => [
                    'id' => $line->id,
                    'product_id' => $line->product_id,
                    'product' => $line->relationLoaded('product') ? [
                        'id' => $line->product?->id,
                        'name' => $line->product?->name,
                        'sku' => $line->product?->sku,
                    ] : null,
                    'quantity' => (float) $line->quantity,
                ]);
            }),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
