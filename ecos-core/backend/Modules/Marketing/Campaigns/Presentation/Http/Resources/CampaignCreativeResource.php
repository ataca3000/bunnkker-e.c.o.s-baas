<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class CampaignCreativeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'marketing_connection_id' => $this->marketing_connection_id,
            'marketing_campaign_id' => $this->marketing_campaign_id,
            'marketing_campaign_ad_id' => $this->marketing_campaign_ad_id,
            'external_creative_id' => $this->external_creative_id,
            'name' => $this->name,
            'creative_type' => $this->creative_type->value,
            'headline' => $this->headline,
            'primary_text' => $this->primary_text,
            'call_to_action' => $this->call_to_action,
            'image_url' => $this->image_url,
            'video_url' => $this->video_url,
            'thumbnail_url' => $this->thumbnail_url,
            'link_url' => $this->link_url,
            'asset_feed' => $this->asset_feed,
            'has_media' => $this->hasMedia(),
            'last_synced_at' => $this->last_synced_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
