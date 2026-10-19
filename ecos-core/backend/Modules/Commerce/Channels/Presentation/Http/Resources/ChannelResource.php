<?php

declare(strict_types=1);

namespace Modules\Commerce\Channels\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Commerce\Channels\Domain\Models\Channel;

/**
 * @mixin Channel
 */
final class ChannelResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'brand_id' => $this->brand_id,
            'brand' => $this->whenLoaded('brand', fn (): array => [
                'id' => $this->brand->id,
                'code' => $this->brand->code,
                'name' => $this->brand->name,
                'company' => $this->brand->relationLoaded('company') && $this->brand->company ? [
                    'id' => $this->brand->company->id,
                    'name' => $this->brand->company->name,
                ] : null,
            ]),
            'code' => $this->code,
            'business_account_id' => $this->business_account_id,
            'business_account' => $this->whenLoaded('businessAccount', fn (): array => [
                'id' => $this->businessAccount->id,
                'code' => $this->businessAccount->code,
                'name' => $this->businessAccount->name,
                'provider' => $this->businessAccount->provider,
            ]),
            'name' => $this->name,
            'channel_type' => $this->channel_type,
            'channel_role' => $this->channel_role,
            'platform' => $this->platform->value,
            'platform_label' => $this->platform->label(),
            'store_url' => $this->store_url,
            'is_active' => (bool) $this->is_active,
            'sync_products' => (bool) $this->sync_products,
            'sync_prices' => (bool) $this->sync_prices,
            'sync_stock' => (bool) $this->sync_stock,
            'sync_customers' => (bool) $this->sync_customers,
            'connection_status' => $this->connection_status->value,
            'connection_status_label' => $this->connection_status->label(),
            'last_sync_at' => $this->last_sync_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
