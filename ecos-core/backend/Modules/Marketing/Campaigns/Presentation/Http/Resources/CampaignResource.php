<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class CampaignResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $insight = $this->latestInsight();

        return [
            'id' => $this->id,
            'marketing_connection_id' => $this->marketing_connection_id,
            'marketing_initiative_id' => $this->marketing_initiative_id,
            'company_id' => $this->company_id,
            'connector_type' => $this->connector_type->value,
            'external_campaign_id' => $this->external_campaign_id,
            'external_account_id' => $this->external_account_id,
            'name' => $this->name,
            'status' => $this->status->value,
            'objective' => $this->objective?->value,
            'buying_type' => $this->buying_type,
            'bid_strategy' => $this->bid_strategy,
            'daily_budget' => $this->daily_budget,
            'lifetime_budget' => $this->lifetime_budget,
            'budget_remaining' => $this->budget_remaining,
            'budget_display' => $this->budgetDisplay(),
            'start_time' => $this->start_time?->toIso8601String(),
            'stop_time' => $this->stop_time?->toIso8601String(),
            'health_status' => $this->health_status,
            'last_synced_at' => $this->last_synced_at?->toIso8601String(),
            'next_sync_at' => $this->next_sync_at?->toIso8601String(),
            'provider_created_at' => $this->provider_created_at?->toIso8601String(),
            'provider_updated_at' => $this->provider_updated_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),

            // Latest insight KPIs (summary — full history via /insights endpoint)
            'latest_insight' => $insight ? [
                'date_start' => $insight->date_start?->toDateString(),
                'date_stop' => $insight->date_stop?->toDateString(),
                'spend' => $insight->spend,
                'impressions' => $insight->impressions,
                'clicks' => $insight->clicks,
                'ctr' => $insight->ctr,
                'cpc' => $insight->cpc,
                'cpm' => $insight->cpm,
                'reach' => $insight->reach,
                'purchases' => $insight->purchases,
                'leads' => $insight->leads,
                'messages' => $insight->messages,
                'synced_at' => $insight->synced_at?->toIso8601String(),
            ] : null,

            // Related resources (included via with())
            'business_context' => $this->whenLoaded('businessContext', fn () => [
                'company_id' => $this->businessContext?->company_id,
                'brand_id' => $this->businessContext?->brand_id,
                'channel_id' => $this->businessContext?->channel_id,
                'season' => $this->businessContext?->season?->value,
                'business_goal' => $this->businessContext?->business_goal?->value,
                'internal_priority' => $this->businessContext?->internal_priority,
                'internal_status' => $this->businessContext?->internal_status,
                'internal_notes' => $this->businessContext?->internal_notes,
                'internal_tags' => $this->businessContext?->internal_tags,
                'marketing_owner_id' => $this->businessContext?->marketing_owner_id,
                'cost_center' => $this->businessContext?->cost_center,
                'marketing_team' => $this->businessContext?->marketing_team,
                'business_unit' => $this->businessContext?->business_unit,
                'custom_season' => $this->businessContext?->custom_season,
                'updated_by' => $this->businessContext?->updated_by,
            ]),
            'ad_sets_count' => $this->whenCounted('adSets'),
            'ads_count' => $this->whenCounted('ads'),
        ];
    }
}
