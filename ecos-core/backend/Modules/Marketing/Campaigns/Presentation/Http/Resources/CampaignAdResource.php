<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class CampaignAdResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'marketing_campaign_id' => $this->marketing_campaign_id,
            'marketing_campaign_ad_set_id' => $this->marketing_campaign_ad_set_id,
            'marketing_connection_id' => $this->marketing_connection_id,
            'external_ad_id' => $this->external_ad_id,
            'external_ad_set_id' => $this->external_ad_set_id,
            'external_campaign_id' => $this->external_campaign_id,
            'name' => $this->name,
            'status' => $this->status,
            'creative_id' => $this->creative_id,
            'last_synced_at' => $this->last_synced_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'creative' => $this->whenLoaded('creative', fn () => new CampaignCreativeResource($this->creative)),
        ];
    }
}
