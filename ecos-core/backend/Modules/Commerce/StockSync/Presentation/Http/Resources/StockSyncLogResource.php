<?php

declare(strict_types=1);

namespace Modules\Commerce\StockSync\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Commerce\StockSync\Domain\Models\StockSyncLog;

/** @mixin StockSyncLog */
final class StockSyncLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'channel_id' => $this->channel_id,
            'product_id' => $this->product_id,
            'product_mapping_id' => $this->product_mapping_id,
            'stock_quantity' => $this->stock_quantity,
            'sync_status' => $this->sync_status->value,
            'response_message' => $this->response_message,
            'synced_at' => $this->synced_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'channel' => $this->whenLoaded('channel', fn () => [
                'id' => $this->channel->id,
                'name' => $this->channel->name,
                'platform' => $this->channel->platform->value,
            ]),
            'product' => $this->whenLoaded('product', fn () => [
                'id' => $this->product->id,
                'name' => $this->product->name,
                'sku' => $this->product->sku,
            ]),
        ];
    }
}
