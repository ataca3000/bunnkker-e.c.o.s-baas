<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Application\Services;

use Carbon\Carbon;
use Modules\Marketing\Campaigns\Domain\Contracts\CampaignConnectorContract;
use Modules\Marketing\Campaigns\Domain\Events\InsightsSyncCompleted;
use Modules\Marketing\Campaigns\Domain\Events\InsightsSyncFailed;
use Modules\Marketing\Campaigns\Domain\Events\InsightsSyncStarted;
use Modules\Marketing\Campaigns\Domain\Events\MetricsUpdated;
use Modules\Marketing\Campaigns\Domain\Models\Campaign;
use Modules\Marketing\Campaigns\Domain\Models\CampaignInsight;
use Modules\Marketing\Connections\Application\Services\ConnectorRegistry;
use Modules\Marketing\Connections\Domain\Models\MarketingAuditLog;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Throwable;

/**
 * Fetches and persists campaign insights as IMMUTABLE historical snapshots.
 *
 * INVARIANT: Existing rows are NEVER modified — every sync creates NEW rows.
 *
 * Rolling Refresh Policy:
 *   today        → always fetch (delivery numbers change throughout the day)
 *   last 7 days  → skip if last snapshot for that date is < 4 h old
 *   older        → immutable; skip unless $forceRefresh = true
 */
final class CampaignInsightSyncService
{
    private const HISTORICAL_DAYS_LIMIT = 7;

    public function __construct(
        private readonly ConnectorRegistry $registry,
    ) {}

    // ── Connection-level entry point ──────────────────────────────────────────

    /**
     * @return array{rows_imported: int, rows_skipped: int, errors: int, api_calls: int, duration_ms: int}
     */
    public function syncForConnection(
        MarketingConnection $connection,
        string $datePreset = 'last_30d',
        ?string $dateStart = null,
        ?string $dateStop = null,
        bool $forceRefresh = false,
        bool $includeAdLevel = false,
        ?string $actorId = null,
    ): array {
        $startedAt = hrtime(true);
        $metrics = ['rows_imported' => 0, 'rows_skipped' => 0, 'errors' => 0, 'api_calls' => 0];

        event(new InsightsSyncStarted($connection, 'connection', $datePreset, $dateStart, $dateStop, $actorId));

        try {
            $campaigns = Campaign::where('marketing_connection_id', $connection->id)->get();

            foreach ($campaigns as $campaign) {
                try {
                    $result = $this->syncForCampaign(
                        campaign: $campaign,
                        connection: $connection,
                        datePreset: $datePreset,
                        dateStart: $dateStart,
                        dateStop: $dateStop,
                        includeAdSetLevel: true,
                        includeAdLevel: $includeAdLevel,
                        forceRefresh: $forceRefresh,
                    );

                    $metrics['rows_imported'] += $result['campaign'] + $result['adset'] + $result['ad'];
                    $metrics['rows_skipped'] += $result['skipped'];
                    $metrics['errors'] += $result['errors'];
                    $metrics['api_calls'] += $result['api_calls'];
                } catch (Throwable) {
                    $metrics['errors']++;
                }
            }

            $metrics['duration_ms'] = (int) ((hrtime(true) - $startedAt) / 1_000_000);

            MarketingAuditLog::record(
                entityType: 'connection',
                entityId: $connection->id,
                action: 'insights_synced',
                actorId: $actorId,
                after: [
                    ...$metrics,
                    'date_preset' => $datePreset,
                    'date_start' => $dateStart,
                    'date_stop' => $dateStop,
                ],
                connectionId: $connection->id,
                connectorType: $connection->connector_type->value,
            );

            event(new InsightsSyncCompleted(
                $connection,
                $metrics['rows_imported'],
                $metrics['rows_skipped'],
                $metrics['errors'],
                $metrics['api_calls'],
                $metrics['duration_ms'],
            ));
        } catch (Throwable $e) {
            $durationMs = (int) ((hrtime(true) - $startedAt) / 1_000_000);
            event(new InsightsSyncFailed($connection, $e->getMessage(), $metrics['api_calls'], $durationMs));
            throw $e;
        }

        return $metrics;
    }

    // ── Campaign-level sync ───────────────────────────────────────────────────

    /**
     * Sync insights for a single campaign across all requested levels.
     *
     * @return array{campaign: int, adset: int, ad: int, skipped: int, errors: int, api_calls: int}
     */
    public function syncForCampaign(
        Campaign $campaign,
        MarketingConnection $connection,
        string $datePreset = 'last_30d',
        ?string $dateStart = null,
        ?string $dateStop = null,
        bool $includeAdSetLevel = true,
        bool $includeAdLevel = false,
        bool $forceRefresh = false,
    ): array {
        $connector = $this->resolveConnector($connection);
        if ($connector === null) {
            return ['campaign' => 0, 'adset' => 0, 'ad' => 0, 'skipped' => 0, 'errors' => 0, 'api_calls' => 0];
        }

        $counts = ['campaign' => 0, 'adset' => 0, 'ad' => 0, 'skipped' => 0, 'errors' => 0, 'api_calls' => 0];

        [$resolvedStart, $resolvedStop] = $this->resolveDateRange($datePreset, $dateStart, $dateStop);

        // Campaign-level
        try {
            $rows = $connector->fetchInsights(
                $campaign->external_campaign_id,
                'campaign',
                $connection,
                $datePreset,
                $dateStart,
                $dateStop,
            );
            $counts['api_calls']++;

            foreach ($rows as $row) {
                if (! $forceRefresh && $this->isImmutable($row['date_start'] ?? $resolvedStart)) {
                    $counts['skipped']++;

                    continue;
                }
                $this->createInsightSnapshot($row, $campaign->id, null, null, $connection, 'campaign', $datePreset);
                $counts['campaign']++;
            }

            if ($counts['campaign'] > 0) {
                event(new MetricsUpdated($campaign->id, 'campaign', $resolvedStart, $resolvedStop, $counts['campaign']));
            }
        } catch (Throwable) {
            $counts['errors']++;
        }

        if (! $includeAdSetLevel) {
            return $counts;
        }

        // Ad Set-level
        foreach ($campaign->adSets as $adSet) {
            try {
                $rows = $connector->fetchInsights(
                    $adSet->external_ad_set_id,
                    'adset',
                    $connection,
                    $datePreset,
                    $dateStart,
                    $dateStop,
                );
                $counts['api_calls']++;

                foreach ($rows as $row) {
                    if (! $forceRefresh && $this->isImmutable($row['date_start'] ?? $resolvedStart)) {
                        $counts['skipped']++;

                        continue;
                    }
                    $this->createInsightSnapshot($row, $campaign->id, $adSet->id, null, $connection, 'adset', $datePreset);
                    $counts['adset']++;
                }

                if (! $includeAdLevel) {
                    continue;
                }

                foreach ($adSet->ads as $ad) {
                    try {
                        $adRows = $connector->fetchInsights(
                            $ad->external_ad_id,
                            'ad',
                            $connection,
                            $datePreset,
                            $dateStart,
                            $dateStop,
                        );
                        $counts['api_calls']++;

                        foreach ($adRows as $row) {
                            if (! $forceRefresh && $this->isImmutable($row['date_start'] ?? $resolvedStart)) {
                                $counts['skipped']++;

                                continue;
                            }
                            $this->createInsightSnapshot($row, $campaign->id, $adSet->id, $ad->id, $connection, 'ad', $datePreset);
                            $counts['ad']++;
                        }
                    } catch (Throwable) {
                        $counts['errors']++;
                    }
                }
            } catch (Throwable) {
                $counts['errors']++;
            }
        }

        return $counts;
    }

    // ── Backfill ──────────────────────────────────────────────────────────────

    /**
     * Historical backfill split into monthly chunks to avoid Meta API rate limits.
     *
     * @return array{campaign: int, adset: int, total_errors: int}
     */
    public function backfill(
        Campaign $campaign,
        MarketingConnection $connection,
        string $dateStart,
        string $dateStop,
    ): array {
        $totals = ['campaign' => 0, 'adset' => 0, 'total_errors' => 0];

        foreach ($this->splitIntoMonthlyChunks($dateStart, $dateStop) as [$chunkStart, $chunkStop]) {
            $result = $this->syncForCampaign(
                campaign: $campaign,
                connection: $connection,
                dateStart: $chunkStart,
                dateStop: $chunkStop,
                includeAdSetLevel: true,
                forceRefresh: true,
            );

            $totals['campaign'] += $result['campaign'];
            $totals['adset'] += $result['adset'];
            $totals['total_errors'] += $result['errors'];
        }

        return $totals;
    }

    // ── Snapshot creation ─────────────────────────────────────────────────────

    /** @param array<string, mixed> $row */
    private function createInsightSnapshot(
        array $row,
        string $campaignId,
        ?string $adSetId,
        ?string $adId,
        MarketingConnection $connection,
        string $level,
        string $datePreset,
    ): CampaignInsight {
        $actionMap = $this->buildActionMap($row['actions'] ?? []);
        $actionValueMap = $this->buildActionMap($row['action_values'] ?? [], floats: true);
        $cpaMap = $this->buildActionMap($row['cost_per_action_type'] ?? [], floats: true);

        // ROAS: website_purchase_roas takes precedence over purchase_roas
        $roasWebsite = $this->extractFirstValue($row['website_purchase_roas'] ?? []);
        $roas = $roasWebsite ?? $this->extractFirstValue($row['purchase_roas'] ?? []);

        return CampaignInsight::create([
            'marketing_campaign_id' => $campaignId,
            'marketing_campaign_ad_set_id' => $adSetId,
            'marketing_campaign_ad_id' => $adId,
            'marketing_connection_id' => $connection->id,
            'connector_type' => $connection->connector_type->value,
            'level' => $level,
            'date_start' => $row['date_start'] ?? now()->toDateString(),
            'date_stop' => $row['date_stop'] ?? now()->toDateString(),
            'date_preset' => $datePreset,

            // Delivery
            'spend' => isset($row['spend']) ? (float) $row['spend'] : null,
            'reach' => isset($row['reach']) ? (int) $row['reach'] : null,
            'impressions' => isset($row['impressions']) ? (int) $row['impressions'] : null,
            'frequency' => isset($row['frequency']) ? (float) $row['frequency'] : null,

            // Efficiency — Meta returns CTR as a percentage string (e.g. "1.5" means 1.5%)
            'cpm' => isset($row['cpm']) ? (float) $row['cpm'] : null,
            'cpc' => isset($row['cpc']) ? (float) $row['cpc'] : null,
            'ctr' => isset($row['ctr']) ? round((float) $row['ctr'] / 100, 8) : null,
            'unique_ctr' => isset($row['unique_ctr']) ? round((float) $row['unique_ctr'] / 100, 8) : null,

            // Traffic
            'clicks' => isset($row['clicks']) ? (int) $row['clicks'] : null,
            'unique_clicks' => isset($row['unique_clicks']) ? (int) $row['unique_clicks'] : null,
            'outbound_clicks' => isset($row['outbound_clicks'][0]['value']) ? (int) $row['outbound_clicks'][0]['value'] : null,
            'landing_page_views' => $actionMap['landing_page_view'] ?? null,
            'video_views' => $actionMap['video_view'] ?? null,

            // Conversions
            'messages' => $actionMap['onsite_conversion.messaging_conversation_started_7d'] ?? null,
            'leads' => $actionMap['lead'] ?? null,
            'purchases' => $actionMap['purchase'] ?? ($actionMap['omni_purchase'] ?? null),
            'purchase_value' => $actionValueMap['purchase'] ?? ($actionValueMap['omni_purchase'] ?? null),
            'add_to_cart' => $actionMap['add_to_cart'] ?? null,
            'initiate_checkout' => $actionMap['initiate_checkout'] ?? null,
            'conversions' => $actionMap['offsite_conversion.fb_pixel_purchase'] ?? ($actionMap['purchase'] ?? null),
            'engagement' => $actionMap['post_engagement'] ?? null,

            // Cost & Return
            'cost_per_result' => isset($row['cost_per_result'][0]['value']) ? (float) $row['cost_per_result'][0]['value'] : null,
            'cpa' => $cpaMap['purchase'] ?? ($cpaMap['omni_purchase'] ?? null),
            'roas' => $roas,
            'roas_website' => $roasWebsite,

            // Raw provider data
            'actions' => $row['actions'] ?? null,
            'breakdowns' => null,

            'synced_at' => now(),
            'created_at' => now(),
        ]);
    }

    // ── Rolling refresh policy ────────────────────────────────────────────────

    /** Returns true if the given date is too old to refresh without forceRefresh. */
    private function isImmutable(string $date): bool
    {
        return (int) Carbon::parse($date)->diffInDays(now(), absolute: true) > self::HISTORICAL_DAYS_LIMIT;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Build a keyed map from a Meta actions / action_values / cost_per_action_type array.
     *
     * @param  list<array<string, mixed>>  $items
     * @return array<string, int|float>
     */
    private function buildActionMap(array $items, bool $floats = false): array
    {
        $map = [];
        foreach ($items as $item) {
            $key = $item['action_type'] ?? '';
            if ($key === '') {
                continue;
            }
            $map[$key] = $floats ? (float) ($item['value'] ?? 0) : (int) ($item['value'] ?? 0);
        }

        return $map;
    }

    /**
     * Extract the numeric value from the first element of a Meta ROAS array.
     * Input shape: [{action_type: "omni_purchase", value: "2.5"}]
     */
    private function extractFirstValue(array $items): ?float
    {
        $first = reset($items);
        if ($first === false || ! isset($first['value'])) {
            return null;
        }

        return (float) $first['value'];
    }

    /**
     * Resolve a date range from a preset. Returns [start, stop] as 'Y-m-d' strings.
     *
     * @return array{0: string, 1: string}
     */
    private function resolveDateRange(string $datePreset, ?string $dateStart, ?string $dateStop): array
    {
        if ($dateStart !== null && $dateStop !== null) {
            return [$dateStart, $dateStop];
        }

        $today = now()->toDateString();

        return match ($datePreset) {
            'last_7d' => [now()->subDays(7)->toDateString(), $today],
            'last_30d' => [now()->subDays(30)->toDateString(), $today],
            'last_90d' => [now()->subDays(90)->toDateString(), $today],
            'last_180d' => [now()->subDays(180)->toDateString(), $today],
            'this_month' => [now()->startOfMonth()->toDateString(), $today],
            default => [now()->subDays(30)->toDateString(), $today],
        };
    }

    /**
     * Split a date range into monthly chunks to prevent API rate-limit failures
     * on large backfill requests.
     *
     * @return list<array{0: string, 1: string}>
     */
    private function splitIntoMonthlyChunks(string $dateStart, string $dateStop): array
    {
        $chunks = [];
        $current = Carbon::parse($dateStart)->startOfDay();
        $end = Carbon::parse($dateStop)->startOfDay();

        while ($current->lte($end)) {
            $chunkEnd = $current->copy()->endOfMonth()->min($end);
            $chunks[] = [$current->toDateString(), $chunkEnd->toDateString()];
            $current = $chunkEnd->copy()->addDay();
        }

        return $chunks;
    }

    private function resolveConnector(MarketingConnection $connection): ?CampaignConnectorContract
    {
        $type = $connection->connector_type->value;

        if (! $this->registry->has($type)) {
            return null;
        }

        $connector = $this->registry->get($type);

        return $connector instanceof CampaignConnectorContract ? $connector : null;
    }
}
