<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Application\Services;

use Modules\Marketing\Assets\Domain\Enums\AssetType;
use Modules\Marketing\Assets\Domain\Models\MarketingAsset;
use Modules\Marketing\Campaigns\Domain\Contracts\CampaignConnectorContract;
use Modules\Marketing\Campaigns\Domain\Events\AdDiscovered;
use Modules\Marketing\Campaigns\Domain\Events\AdSetDiscovered;
use Modules\Marketing\Campaigns\Domain\Events\AdSetUpdated;
use Modules\Marketing\Campaigns\Domain\Events\AdUpdated;
use Modules\Marketing\Campaigns\Domain\Events\CampaignDiscovered;
use Modules\Marketing\Campaigns\Domain\Events\CampaignUpdated;
use Modules\Marketing\Campaigns\Domain\Events\CreativeDiscovered;
use Modules\Marketing\Campaigns\Domain\Events\CreativeUpdated;
use Modules\Marketing\Campaigns\Domain\Models\Campaign;
use Modules\Marketing\Campaigns\Domain\Models\CampaignAd;
use Modules\Marketing\Campaigns\Domain\Models\CampaignAdSet;
use Modules\Marketing\Campaigns\Domain\Models\CampaignCreative;
use Modules\Marketing\Connections\Application\Services\ConnectorRegistry;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Modules\Marketing\Synchronization\Domain\Enums\SyncType;
use Throwable;

/**
 * Orchestrates full or incremental campaign structure discovery for a Marketing Connection.
 *
 * Flow:
 *  1. Find all Ad Account assets linked to the connection
 *  2. For each ad account, discover campaigns (filtered by updated_since on incremental)
 *  3. For each campaign, discover ad sets
 *  4. For each ad set, discover ads
 *  5. For each ad, discover creatives (when $includeCreatives = true)
 *
 * Upserts are idempotent — keyed on provider external IDs.
 * Every create / update fires a typed domain event.
 * Historical insights sync is handled separately by CampaignInsightSyncService.
 */
final class CampaignSyncService
{
    public function __construct(
        private readonly ConnectorRegistry $registry,
    ) {}

    /**
     * @return array{
     *   campaigns_created: int, campaigns_updated: int,
     *   ad_sets_created: int, ad_sets_updated: int,
     *   ads_created: int, ads_updated: int,
     *   creatives_created: int, creatives_updated: int,
     *   errors: int, duration_ms: int, api_calls: int
     * }
     */
    public function syncForConnection(
        MarketingConnection $connection,
        bool $includeCreatives = true,
        SyncType $syncType = SyncType::Full,
    ): array {
        $connectorType = $connection->connector_type->value;

        $empty = [
            'campaigns_created' => 0, 'campaigns_updated' => 0,
            'ad_sets_created' => 0, 'ad_sets_updated' => 0,
            'ads_created' => 0, 'ads_updated' => 0,
            'creatives_created' => 0, 'creatives_updated' => 0,
            'errors' => 0,
            'duration_ms' => 0,
            'api_calls' => 0,
        ];

        if (! $this->registry->has($connectorType)) {
            return $empty;
        }

        $connector = $this->registry->get($connectorType);

        if (! $connector instanceof CampaignConnectorContract) {
            return $empty;
        }

        $adAccounts = MarketingAsset::where('marketing_connection_id', $connection->id)
            ->where('asset_type', AssetType::AdAccount->value)
            ->get();

        $counts = $empty;
        $startedAt = hrtime(true);

        // Incremental sync: only fetch campaigns modified since last sync
        $extraParams = [];
        if ($syncType === SyncType::Incremental && $connection->last_synced_at !== null) {
            $extraParams['updated_since'] = $connection->last_synced_at->timestamp;
        }

        foreach ($adAccounts as $adAccount) {
            try {
                $this->syncAdAccount(
                    $connector, $connection, $adAccount->external_id,
                    $includeCreatives, $extraParams, $counts,
                );
            } catch (Throwable) {
                $counts['errors']++;
            }
        }

        $counts['duration_ms'] = (int) ((hrtime(true) - $startedAt) / 1_000_000);

        return $counts;
    }

    /**
     * @param  array<string, mixed>  $extraParams
     * @param  array<string, int>  $counts
     */
    private function syncAdAccount(
        CampaignConnectorContract $connector,
        MarketingConnection $connection,
        string $adAccountId,
        bool $includeCreatives,
        array $extraParams,
        array &$counts,
    ): void {
        $campaignDescriptors = $connector->discoverCampaigns($adAccountId, $connection, $extraParams);
        $counts['api_calls']++;

        foreach ($campaignDescriptors as $descriptor) {
            try {
                [$campaign, $campIsNew, $campPrevStatus] = $this->upsertCampaign($connection, $adAccountId, $descriptor);

                if ($campIsNew) {
                    $counts['campaigns_created']++;
                    event(new CampaignDiscovered($campaign, true));
                } else {
                    $counts['campaigns_updated']++;
                    event(new CampaignDiscovered($campaign, false));
                    if ($campPrevStatus !== null && $campPrevStatus !== ($campaign->status?->value ?? $campaign->status)) {
                        event(new CampaignUpdated($campaign, $campPrevStatus));
                    }
                }

                // Ad Sets
                $adSetDescriptors = $connector->discoverAdSets($descriptor['external_campaign_id'], $connection);
                $counts['api_calls']++;

                foreach ($adSetDescriptors as $asDescriptor) {
                    try {
                        [$adSet, $asIsNew, $asPrevStatus] = $this->upsertAdSet($connection, $campaign, $asDescriptor);

                        if ($asIsNew) {
                            $counts['ad_sets_created']++;
                            event(new AdSetDiscovered($adSet, true));
                        } else {
                            $counts['ad_sets_updated']++;
                            event(new AdSetDiscovered($adSet, false));
                            if ($asPrevStatus !== null && $asPrevStatus !== $adSet->status) {
                                event(new AdSetUpdated($adSet, $asPrevStatus));
                            }
                        }

                        // Ads
                        $adDescriptors = $connector->discoverAds($asDescriptor['external_ad_set_id'], $connection);
                        $counts['api_calls']++;

                        foreach ($adDescriptors as $adDescriptor) {
                            try {
                                [$ad, $adIsNew, $adPrevStatus] = $this->upsertAd(
                                    $connection, $campaign, $adSet, $adDescriptor,
                                );

                                if ($adIsNew) {
                                    $counts['ads_created']++;
                                    event(new AdDiscovered($ad, true));
                                } else {
                                    $counts['ads_updated']++;
                                    event(new AdDiscovered($ad, false));
                                    if ($adPrevStatus !== null && $adPrevStatus !== $ad->status) {
                                        event(new AdUpdated($ad, $adPrevStatus));
                                    }
                                }

                                // Creatives (optional, skip when creative_id absent)
                                if ($includeCreatives && ! empty($adDescriptor['creative_id'])) {
                                    try {
                                        $creatives = $connector->discoverCreatives(
                                            $adDescriptor['external_ad_id'], $connection,
                                        );
                                        $counts['api_calls']++;

                                        foreach ($creatives as $cDescriptor) {
                                            [$creative, $creativeIsNew] = $this->upsertCreative(
                                                $connection, $campaign, $ad, $cDescriptor,
                                            );

                                            if ($creativeIsNew) {
                                                $counts['creatives_created']++;
                                                event(new CreativeDiscovered($creative, true));
                                            } else {
                                                $counts['creatives_updated']++;
                                                event(new CreativeDiscovered($creative, false));
                                                event(new CreativeUpdated($creative));
                                            }
                                        }
                                    } catch (Throwable) {
                                        $counts['errors']++;
                                    }
                                }
                            } catch (Throwable) {
                                $counts['errors']++;
                            }
                        }
                    } catch (Throwable) {
                        $counts['errors']++;
                    }
                }
            } catch (Throwable) {
                $counts['errors']++;
            }
        }
    }

    /**
     * @param  array<string, mixed>  $d
     * @return array{0: Campaign, 1: bool, 2: string|null} [model, isNew, previousStatus]
     */
    private function upsertCampaign(MarketingConnection $connection, string $adAccountId, array $d): array
    {
        $existing = Campaign::where('connector_type', $connection->connector_type->value)
            ->where('external_campaign_id', $d['external_campaign_id'])
            ->first();

        $previousStatus = $existing?->status?->value ?? $existing?->status;
        $isNew = $existing === null;

        $campaign = Campaign::updateOrCreate(
            [
                'connector_type' => $connection->connector_type->value,
                'external_campaign_id' => $d['external_campaign_id'],
            ],
            [
                'marketing_connection_id' => $connection->id,
                'company_id' => $connection->company_id,
                'external_account_id' => $adAccountId,
                'name' => $d['name'],
                'status' => $d['status'],
                'effective_status' => $d['effective_status'] ?? null,
                'objective' => $d['objective'],
                'buying_type' => $d['buying_type'],
                'bid_strategy' => $d['bid_strategy'],
                'daily_budget' => $d['daily_budget'],
                'lifetime_budget' => $d['lifetime_budget'],
                'budget_remaining' => $d['budget_remaining'],
                'special_ad_categories' => $d['special_ad_categories'] ?? [],
                'start_time' => $d['start_time'],
                'stop_time' => $d['stop_time'],
                'provider_created_at' => $d['provider_created_at'],
                'provider_updated_at' => $d['provider_updated_at'],
                'last_synced_at' => now(),
                'next_sync_at' => now()->addHours(6),
                'provider_payload' => $d['provider_payload'],
            ],
        );

        return [$campaign, $isNew, $previousStatus];
    }

    /**
     * @param  array<string, mixed>  $d
     * @return array{0: CampaignAdSet, 1: bool, 2: string|null}
     */
    private function upsertAdSet(MarketingConnection $connection, Campaign $campaign, array $d): array
    {
        $existing = CampaignAdSet::where('external_ad_set_id', $d['external_ad_set_id'])->first();

        $previousStatus = $existing?->status;
        $isNew = $existing === null;

        $adSet = CampaignAdSet::updateOrCreate(
            ['external_ad_set_id' => $d['external_ad_set_id']],
            [
                'marketing_campaign_id' => $campaign->id,
                'marketing_connection_id' => $connection->id,
                'external_campaign_id' => $campaign->external_campaign_id,
                'name' => $d['name'],
                'status' => $d['status'],
                'effective_status' => $d['effective_status'] ?? null,
                'daily_budget' => $d['daily_budget'],
                'lifetime_budget' => $d['lifetime_budget'],
                'bid_amount' => $d['bid_amount'],
                'bid_strategy' => $d['bid_strategy'],
                'optimization_goal' => $d['optimization_goal'],
                'billing_event' => $d['billing_event'],
                'targeting' => $d['targeting'],
                'schedule' => $d['schedule'] ?? null,
                'start_time' => $d['start_time'],
                'end_time' => $d['end_time'],
                'last_synced_at' => now(),
                'provider_payload' => $d['provider_payload'],
            ],
        );

        return [$adSet, $isNew, $previousStatus];
    }

    /**
     * @param  array<string, mixed>  $d
     * @return array{0: CampaignAd, 1: bool, 2: string|null}
     */
    private function upsertAd(MarketingConnection $connection, Campaign $campaign, CampaignAdSet $adSet, array $d): array
    {
        $existing = CampaignAd::where('external_ad_id', $d['external_ad_id'])->first();

        $previousStatus = $existing?->status;
        $isNew = $existing === null;

        $ad = CampaignAd::updateOrCreate(
            ['external_ad_id' => $d['external_ad_id']],
            [
                'marketing_campaign_id' => $campaign->id,
                'marketing_campaign_ad_set_id' => $adSet->id,
                'marketing_connection_id' => $connection->id,
                'external_ad_set_id' => $d['external_ad_set_id'],
                'external_campaign_id' => $d['external_campaign_id'],
                'name' => $d['name'],
                'status' => $d['status'],
                'effective_status' => $d['effective_status'] ?? null,
                'creative_id' => $d['creative_id'],
                'tracking_specs' => $d['tracking_specs'],
                'preview_url' => $d['preview_url'] ?? null,
                'last_synced_at' => now(),
                'provider_payload' => $d['provider_payload'],
            ],
        );

        return [$ad, $isNew, $previousStatus];
    }

    /**
     * @param  array<string, mixed>  $d
     * @return array{0: CampaignCreative, 1: bool}
     */
    private function upsertCreative(MarketingConnection $connection, Campaign $campaign, CampaignAd $ad, array $d): array
    {
        $isNew = ! CampaignCreative::where('external_creative_id', $d['external_creative_id'])->exists();

        $creative = CampaignCreative::updateOrCreate(
            ['external_creative_id' => $d['external_creative_id']],
            [
                'marketing_connection_id' => $connection->id,
                'marketing_campaign_id' => $campaign->id,
                'marketing_campaign_ad_id' => $ad->id,
                'name' => $d['name'],
                'headline' => $d['headline'],
                'primary_text' => $d['primary_text'],
                'call_to_action' => $d['call_to_action'],
                'image_url' => $d['image_url'],
                'image_hash' => $d['image_hash'] ?? null,
                'video_url' => $d['video_url'],
                'video_id' => $d['video_id'] ?? null,
                'thumbnail_url' => $d['thumbnail_url'],
                'link_url' => $d['link_url'],
                'asset_feed' => $d['asset_feed'],
                'provider_payload' => $d['provider_payload'],
                'last_synced_at' => now(),
            ],
        );

        return [$creative, $isNew];
    }
}
