<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Domain\Contracts;

use Modules\Marketing\Connections\Domain\Models\MarketingConnection;

/**
 * Optional connector capability — Campaign discovery and insights.
 *
 * Connectors that can synchronize campaigns implement this contract.
 * The CampaignSyncService checks instanceof before calling.
 * Connectors that do NOT implement this (e.g. a Pinterest connector
 * without campaign API access) will be skipped silently.
 */
interface CampaignConnectorContract
{
    /**
     * Discover all campaigns for a given ad account.
     *
     * @param  array<string, mixed>  $params  Optional filter params (status, date range, etc.)
     * @return list<array{
     *   external_campaign_id: string,
     *   external_account_id:  string,
     *   name:                 string,
     *   status:               string,
     *   objective:            string|null,
     *   buying_type:          string|null,
     *   bid_strategy:         string|null,
     *   daily_budget:         float|null,
     *   lifetime_budget:      float|null,
     *   budget_remaining:     float|null,
     *   start_time:           string|null,
     *   stop_time:            string|null,
     *   provider_created_at:  string|null,
     *   provider_updated_at:  string|null,
     *   provider_payload:     array<string, mixed>
     * }>
     */
    public function discoverCampaigns(
        string $adAccountId,
        MarketingConnection $connection,
        array $params = [],
    ): array;

    /**
     * Discover all ad sets for a campaign.
     *
     * @return list<array{
     *   external_ad_set_id:  string,
     *   external_campaign_id: string,
     *   name:                string,
     *   status:              string,
     *   daily_budget:        float|null,
     *   lifetime_budget:     float|null,
     *   bid_amount:          float|null,
     *   bid_strategy:        string|null,
     *   optimization_goal:   string|null,
     *   billing_event:       string|null,
     *   targeting:           array<string, mixed>|null,
     *   start_time:          string|null,
     *   end_time:            string|null,
     *   provider_payload:    array<string, mixed>
     * }>
     */
    public function discoverAdSets(
        string $campaignId,
        MarketingConnection $connection,
    ): array;

    /**
     * Discover all ads for an ad set.
     *
     * @return list<array{
     *   external_ad_id:      string,
     *   external_ad_set_id:  string,
     *   external_campaign_id: string,
     *   name:                string,
     *   status:              string,
     *   creative_id:         string|null,
     *   tracking_specs:      array<string, mixed>|null,
     *   provider_payload:    array<string, mixed>
     * }>
     */
    public function discoverAds(
        string $adSetId,
        MarketingConnection $connection,
    ): array;

    /**
     * Fetch campaign-level insights for a date range.
     *
     * @return list<array<string, mixed>>
     */
    public function fetchInsights(
        string $entityId,
        string $level,   // 'campaign' | 'adset' | 'ad'
        MarketingConnection $connection,
        string $datePreset = 'last_30d',
        ?string $dateStart = null,
        ?string $dateStop = null,
    ): array;

    /**
     * Discover creatives for a single ad.
     *
     * @return list<array<string, mixed>>
     */
    public function discoverCreatives(
        string $adId,
        MarketingConnection $connection,
    ): array;
}
