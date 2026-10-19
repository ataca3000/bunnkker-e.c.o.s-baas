<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class CampaignAdSetResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'marketing_campaign_id' => $this->marketing_campaign_id,
            'marketing_connection_id' => $this->marketing_connection_id,
            'external_ad_set_id' => $this->external_ad_set_id,
            'external_campaign_id' => $this->external_campaign_id,
            'name' => $this->name,
            'status' => $this->status,
            'daily_budget' => $this->daily_budget,
            'lifetime_budget' => $this->lifetime_budget,
            'bid_amount' => $this->bid_amount,
            'bid_strategy' => $this->bid_strategy,
            'optimization_goal' => $this->optimization_goal,
            'billing_event' => $this->billing_event,
            'targeting' => $this->targeting,
            'start_time' => $this->start_time?->toIso8601String(),
            'end_time' => $this->end_time?->toIso8601String(),
            'last_synced_at' => $this->last_synced_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'ads_count' => $this->whenCounted('ads'),
        ];
    }
}
