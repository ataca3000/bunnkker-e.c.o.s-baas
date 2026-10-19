<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Application\Actions;

use Modules\Marketing\Campaigns\Application\Services\CampaignInsightSyncService;
use Modules\Marketing\Campaigns\Application\Services\CampaignSyncService;
use Modules\Marketing\Campaigns\Domain\Models\Campaign;
use Modules\Marketing\Connections\Domain\Models\MarketingAuditLog;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Modules\Marketing\Synchronization\Domain\Enums\SyncType;
use Throwable;

/**
 * Orchestrates a full or incremental campaign structure sync for a connection.
 *
 * 1. Discovers campaigns / ad sets / ads / creatives
 * 2. Optionally syncs campaign-level insights for the last 30 days
 * 3. Logs the sync to the marketing audit log
 */
final class SyncCampaignsAction
{
    public function __construct(
        private readonly CampaignSyncService $syncService,
        private readonly CampaignInsightSyncService $insightService,
    ) {}

    /**
     * @return array{
     *   campaigns_created: int, campaigns_updated: int,
     *   ad_sets_created: int, ad_sets_updated: int,
     *   ads_created: int, ads_updated: int,
     *   creatives_created: int, creatives_updated: int,
     *   insights: int, errors: int, duration_ms: int, api_calls: int,
     *   sync_type: string
     * }
     */
    public function execute(
        MarketingConnection $connection,
        bool $syncInsights = false,
        bool $syncCreatives = true,
        string $insightDatePreset = 'last_30d',
        ?string $actorId = null,
        SyncType $syncType = SyncType::Full,
    ): array {
        $counts = $this->syncService->syncForConnection($connection, $syncCreatives, $syncType);

        $insightCount = 0;

        if ($syncInsights) {
            $campaigns = Campaign::where('marketing_connection_id', $connection->id)
                ->with(['adSets.ads'])
                ->get();

            foreach ($campaigns as $campaign) {
                try {
                    $insightResult = $this->insightService->syncForCampaign(
                        campaign: $campaign,
                        connection: $connection,
                        datePreset: $insightDatePreset,
                        includeAdSetLevel: true,
                        includeAdLevel: false,
                    );
                    $insightCount += $insightResult['campaign'] + $insightResult['adset'];
                } catch (Throwable) {
                    $counts['errors']++;
                }
            }
        }

        $result = [
            ...$counts,
            'insights' => $insightCount,
            'sync_type' => $syncType->value,
            // Backward-compat totals for callers that expect pre-TASK-003 keys
            'campaigns' => $counts['campaigns_created'] + $counts['campaigns_updated'],
            'ad_sets' => $counts['ad_sets_created'] + $counts['ad_sets_updated'],
            'ads' => $counts['ads_created'] + $counts['ads_updated'],
            'creatives' => $counts['creatives_created'] + $counts['creatives_updated'],
        ];

        MarketingAuditLog::record(
            entityType: 'connection',
            entityId: $connection->id,
            action: 'campaigns_synced',
            actorId: $actorId,
            after: $result,
            connectionId: $connection->id,
            connectorType: $connection->connector_type->value,
        );

        return $result;
    }
}
