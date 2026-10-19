<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Application\Actions;

use Modules\Marketing\Campaigns\Application\Services\CampaignInsightSyncService;
use Modules\Marketing\Campaigns\Domain\Models\Campaign;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;

/**
 * Backfill historical insights for a campaign.
 *
 * Supports date range splits into monthly chunks to avoid
 * hitting API rate limits on large backfills.
 */
final class BackfillCampaignInsightsAction
{
    public function __construct(
        private readonly CampaignInsightSyncService $insightService,
    ) {}

    /**
     * @return array{total_campaign: int, total_adset: int, total_errors: int}
     */
    public function execute(
        Campaign $campaign,
        MarketingConnection $connection,
        string $dateStart,
        string $dateStop,
    ): array {
        $result = $this->insightService->backfill(
            campaign: $campaign,
            connection: $connection,
            dateStart: $dateStart,
            dateStop: $dateStop,
        );

        return [
            'total_campaign' => $result['campaign'],
            'total_adset' => $result['adset'],
            'total_errors' => $result['total_errors'],
        ];
    }
}
