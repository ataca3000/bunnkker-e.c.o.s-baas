<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Presentation\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Modules\Marketing\Campaigns\Application\Actions\BackfillCampaignInsightsAction;
use Modules\Marketing\Campaigns\Application\Jobs\InsightsSyncJob;
use Modules\Marketing\Campaigns\Domain\Models\Campaign;
use Modules\Marketing\Campaigns\Domain\Models\CampaignInsight;
use Modules\Marketing\Campaigns\Presentation\Http\Resources\CampaignInsightResource;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;

final class CampaignInsightController extends Controller
{
    public function __construct(
        private readonly BackfillCampaignInsightsAction $backfill,
    ) {}

    /**
     * Insight snapshots with flexible filtering across any dimension.
     *
     * Filters (all optional):
     *   connection_id, ad_set_id, ad_id, level,
     *   date_start, date_stop, date_preset,
     *   connector_type, per_page (max 200)
     *
     * The campaign is the mandatory scope; further dimensions narrow the result.
     */
    public function index(Request $request, Campaign $campaign): AnonymousResourceCollection
    {
        $query = CampaignInsight::query()
            ->where('marketing_campaign_id', $campaign->id)
            ->when($request->query('connection_id'), fn ($q, $v) => $q->where('marketing_connection_id', $v))
            ->when($request->query('ad_set_id'), fn ($q, $v) => $q->where('marketing_campaign_ad_set_id', $v))
            ->when($request->query('ad_id'), fn ($q, $v) => $q->where('marketing_campaign_ad_id', $v))
            ->when($request->query('level'), fn ($q, $v) => $q->where('level', $v))
            ->when($request->query('connector_type'), fn ($q, $v) => $q->where('connector_type', $v))
            ->when($request->query('date_preset'), fn ($q, $v) => $q->where('date_preset', $v))
            ->when($request->query('date_start'), fn ($q, $v) => $q->whereDate('date_start', '>=', $v))
            ->when($request->query('date_stop'), fn ($q, $v) => $q->whereDate('date_stop', '<=', $v));

        $perPage = min((int) $request->query('per_page', 30), 200);

        $insights = $query
            ->orderBy('date_start', 'desc')
            ->orderBy('synced_at', 'desc')
            ->paginate($perPage);

        return CampaignInsightResource::collection($insights);
    }

    /**
     * Aggregated daily trend (campaign-level only).
     * One row per date, latest snapshot per date.
     */
    public function trend(Request $request, Campaign $campaign): AnonymousResourceCollection
    {
        $days = min((int) $request->query('days', 30), 365);
        $dateFrom = now()->subDays($days)->toDateString();

        $insights = CampaignInsight::query()
            ->where('marketing_campaign_id', $campaign->id)
            ->where('level', 'campaign')
            ->when($request->query('connection_id'), fn ($q, $v) => $q->where('marketing_connection_id', $v))
            ->whereDate('date_start', '>=', $dateFrom)
            ->orderBy('date_start')
            ->orderByDesc('synced_at')
            ->get()
            ->unique('date_start');

        return CampaignInsightResource::collection($insights);
    }

    /**
     * Dispatch an async insights sync for a connection.
     * POST /marketing/connections/{connection}/insights/sync
     */
    public function sync(Request $request, MarketingConnection $connection): \Illuminate\Http\JsonResponse
    {
        $data = $request->validate([
            'date_preset' => 'nullable|string|in:last_7d,last_30d,last_90d,last_180d,this_month',
            'date_start' => 'nullable|date_format:Y-m-d',
            'date_stop' => 'nullable|date_format:Y-m-d|after_or_equal:date_start',
            'force_refresh' => 'nullable|boolean',
            'include_ad_level' => 'nullable|boolean',
        ]);

        InsightsSyncJob::dispatch(
            connectionId: $connection->id,
            datePreset: $data['date_preset'] ?? 'last_30d',
            dateStart: $data['date_start'] ?? null,
            dateStop: $data['date_stop'] ?? null,
            forceRefresh: (bool) ($data['force_refresh'] ?? false),
            includeAdLevel: (bool) ($data['include_ad_level'] ?? false),
            actorId: $request->user()?->id,
        );

        return response()->json(['message' => 'Insights sync dispatched.'], 202);
    }

    /**
     * Historical backfill for a specific campaign + date range.
     * POST /marketing/campaigns/{campaign}/insights/backfill
     */
    public function backfill(Request $request, Campaign $campaign): \Illuminate\Http\JsonResponse
    {
        $data = $request->validate([
            'connection_id' => 'required|uuid|exists:marketing_connections,id',
            'date_start' => 'required|date_format:Y-m-d',
            'date_stop' => 'required|date_format:Y-m-d|after_or_equal:date_start',
        ]);

        $connection = MarketingConnection::findOrFail($data['connection_id']);

        $result = $this->backfill->execute(
            campaign: $campaign,
            connection: $connection,
            dateStart: $data['date_start'],
            dateStop: $data['date_stop'],
        );

        return response()->json(['data' => $result]);
    }
}
