<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\Campaigns\Application\Actions\BackfillCampaignInsightsAction;
use Modules\Marketing\Campaigns\Application\Actions\SyncCampaignsAction;
use Modules\Marketing\Campaigns\Application\Jobs\SyncCampaignsJob;
use Modules\Marketing\Campaigns\Domain\Models\Campaign;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Modules\Marketing\Synchronization\Domain\Enums\SyncType;

final class CampaignSyncController extends Controller
{
    public function __construct(
        private readonly SyncCampaignsAction $syncAction,
        private readonly BackfillCampaignInsightsAction $backfillAction,
    ) {}

    /**
     * Trigger a campaign structure sync for a connection.
     * POST /marketing/connections/{connection}/campaigns/sync
     *
     * Pass `queue=true` for async dispatch (returns 202 Accepted).
     */
    public function triggerSync(Request $request, MarketingConnection $connection): JsonResponse
    {
        $validated = $request->validate([
            'sync_type' => ['nullable', 'string', 'in:full,incremental'],
            'sync_insights' => ['boolean'],
            'sync_creatives' => ['boolean'],
            'insight_date_preset' => ['nullable', 'string', 'in:last_7d,last_30d,last_90d,last_180d,this_month'],
            'queue' => ['boolean'],
        ]);

        $syncType = SyncType::tryFrom($validated['sync_type'] ?? 'full') ?? SyncType::Full;
        $queued = (bool) ($validated['queue'] ?? false);
        $actorId = $request->user()?->id;

        if ($queued) {
            SyncCampaignsJob::dispatch(
                connectionId: $connection->id,
                syncType: $syncType->value,
                includeCreatives: (bool) ($validated['sync_creatives'] ?? true),
                actorId: $actorId,
            );

            return response()->json([
                'message' => 'Campaign sync queued.',
                'queued' => true,
                'sync_type' => $syncType->value,
            ], 202);
        }

        $result = $this->syncAction->execute(
            connection: $connection,
            syncInsights: (bool) ($validated['sync_insights'] ?? false),
            syncCreatives: (bool) ($validated['sync_creatives'] ?? true),
            insightDatePreset: $validated['insight_date_preset'] ?? 'last_30d',
            actorId: $actorId,
            syncType: $syncType,
        );

        return response()->json([
            'message' => 'Campaign sync completed.',
            'result' => $result,
        ]);
    }

    /**
     * Backfill historical insights for a specific campaign.
     * POST /marketing/campaigns/{campaign}/backfill
     */
    public function backfill(Request $request, Campaign $campaign): JsonResponse
    {
        $validated = $request->validate([
            'date_start' => ['required', 'date_format:Y-m-d'],
            'date_stop' => ['required', 'date_format:Y-m-d', 'after_or_equal:date_start'],
        ]);

        $connection = $campaign->connection;
        if ($connection === null) {
            return response()->json(['message' => 'Campaign has no associated connection.'], 422);
        }

        $result = $this->backfillAction->execute(
            campaign: $campaign,
            connection: $connection,
            dateStart: $validated['date_start'],
            dateStop: $validated['date_stop'],
        );

        return response()->json([
            'message' => 'Backfill completed.',
            'result' => $result,
        ]);
    }
}
