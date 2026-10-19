<?php

declare(strict_types=1);

namespace Modules\Marketing\Intelligence\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\Intelligence\Application\Actions\GenerateReportAction;
use Modules\Marketing\Intelligence\Application\Dto\IntelligenceFilterDto;
use Modules\Marketing\Intelligence\Application\Services\MarketingKpiEngine;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Campaign Analytics — ranked, sortable, filterable, exportable.
 *
 * GET /marketing/intelligence/campaigns              — paginated table
 * GET /marketing/intelligence/campaigns/export       — CSV / Excel / HTML export
 * GET /marketing/intelligence/campaigns/{id}/trend   — 7-day sparkline for one campaign
 *
 * Supported query params:
 *   company_id, connection_id, ad_account_id, campaign_id, status, date_preset,
 *   date_start, date_stop, sort_by, sort_direction, group_by, per_page, page
 */
final class CampaignAnalyticsController extends Controller
{
    public function __construct(
        private readonly MarketingKpiEngine $engine,
        private readonly GenerateReportAction $reportAction,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filter = IntelligenceFilterDto::fromRequest($request);
        $sortBy = $this->allowedSort($request->query('sort_by', 'total_spend'));
        $sortDir = $request->query('sort_direction', 'desc') === 'asc' ? 'asc' : 'desc';
        $groupBy = $request->query('group_by');
        $perPage = min((int) $request->query('per_page', 20), 200);
        $page = max(1, (int) $request->query('page', 1));

        $result = $this->engine->campaignBreakdown($filter, $sortBy, $sortDir, $groupBy, $perPage, $page);

        [$start, $end] = $filter->resolvedDates();

        return response()->json([
            'data' => $result['data'],
            'meta' => [
                'total' => $result['total'],
                'per_page' => $perPage,
                'current_page' => $page,
                'last_page' => (int) ceil($result['total'] / $perPage),
                'date_from' => $start,
                'date_to' => $end,
                'sort_by' => $sortBy,
                'sort_direction' => $sortDir,
            ],
        ]);
    }

    public function export(Request $request): StreamedResponse|\Illuminate\Http\Response
    {
        $filter = IntelligenceFilterDto::fromRequest($request);
        $format = $this->allowedFormat($request->query('format', 'csv'));
        $sortBy = $this->allowedSort($request->query('sort_by', 'total_spend'));
        $actorId = $request->user()?->id;

        return $this->reportAction->campaignReport($filter, $format, $sortBy, $actorId);
    }

    /**
     * 7-day daily trend for a single campaign (sparkline data).
     */
    public function trend(Request $request, string $campaignId): JsonResponse
    {
        $filter = IntelligenceFilterDto::fromRequest($request)
            ->withCampaignId($campaignId);

        $trendData = $this->engine->trends($filter, 'day', 'campaign');

        return response()->json(['data' => $trendData]);
    }

    private function allowedSort(string $value): string
    {
        $allowed = ['total_spend', 'total_revenue', 'total_purchases', 'total_leads', 'total_clicks', 'total_impressions', 'total_reach'];

        return in_array($value, $allowed, true) ? $value : 'total_spend';
    }

    private function allowedFormat(string $value): string
    {
        return in_array($value, ['csv', 'excel', 'html'], true) ? $value : 'csv';
    }
}
