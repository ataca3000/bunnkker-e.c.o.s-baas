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
 * Ad Analytics — same experience as Campaign Analytics but at the ad level.
 *
 * GET /marketing/intelligence/ads          — paginated ranking table
 * GET /marketing/intelligence/ads/export   — CSV / Excel / HTML
 *
 * Supported filters: company_id, connection_id, campaign_id, ad_set_id,
 *                    status, date_preset, date_start, date_stop,
 *                    sort_by, sort_direction, per_page, page
 */
final class AdAnalyticsController extends Controller
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
        $perPage = min((int) $request->query('per_page', 20), 200);
        $page = max(1, (int) $request->query('page', 1));

        $result = $this->engine->adBreakdown($filter, $sortBy, $sortDir, $perPage, $page);

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
        $format = in_array($request->query('format', 'csv'), ['csv', 'excel', 'html'], true)
            ? $request->query('format', 'csv')
            : 'csv';
        $actorId = $request->user()?->id;

        return $this->reportAction->adReport($filter, $format, $actorId);
    }

    private function allowedSort(string $value): string
    {
        $allowed = ['total_spend', 'total_revenue', 'total_purchases', 'total_leads', 'total_clicks', 'total_impressions'];

        return in_array($value, $allowed, true) ? $value : 'total_spend';
    }
}
