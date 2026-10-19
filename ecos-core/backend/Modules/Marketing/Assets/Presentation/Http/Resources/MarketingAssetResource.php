<?php

declare(strict_types=1);

namespace Modules\Marketing\Assets\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

final class MarketingAssetResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'company_id' => $this->company_id,
            'marketing_connection_id' => $this->marketing_connection_id,
            'connector_type' => $this->connector_type,
            'asset_type' => $this->asset_type,
            'external_id' => $this->external_id,
            'name' => $this->name,
            'status' => $this->status,
            'health_status' => $this->health_status,
            'health_checked_at' => $this->health_checked_at?->toIso8601String(),
            'health_metadata' => $this->health_metadata,
            'asset_metadata' => $this->asset_metadata,
            'last_synced_at' => $this->last_synced_at?->toIso8601String(),
            'next_sync_at' => $this->next_sync_at?->toIso8601String(),
            'relationships_count' => $this->whenCounted('relationships'),
            'connection' => $this->whenLoaded('connection', fn () => [
                'id' => $this->connection->id,
                'label' => $this->connection->label,
                'connector_type' => $this->connection->connector_type,
                'status' => $this->connection->status,
            ]),
            'relationships' => $this->whenLoaded('relationships'),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
