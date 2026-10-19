<?php

declare(strict_types=1);

namespace Modules\Commerce\ProductMappings\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Commerce\ProductMappings\Domain\Models\ProductMapping;

/**
 * @mixin ProductMapping
 */
final class ProductMappingResource extends JsonResource
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
            'channel_id' => $this->channel_id,
            'channel' => $this->whenLoaded('channel', fn () => [
                'id' => $this->channel->id,
                'name' => $this->channel->name,
                'platform' => $this->channel->platform->value,
                'platform_label' => $this->channel->platform->label(),
            ]),
            'external_product_id' => $this->external_product_id,
            'external_sku' => $this->external_sku,
            'sync_status' => $this->sync_status->value,
            'sync_status_label' => $this->sync_status->label(),
            'last_sync_at' => $this->last_sync_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
