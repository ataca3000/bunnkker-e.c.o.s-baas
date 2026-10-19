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
 * Creative Analytics — rank creatives by performance.
 *
 * Includes image_url, video_url, thumbnail_url for media preview.
 *
 * GET /marketing/intelligence/creatives            — paginated ranking table
 * GET /marketing/intelligence/creatives/export     — CSV / Excel / HTML
 *
 * Sort options: total_revenue (ROAS proxy), total_spend, total_purchases,
 *               total_clicks (CTR proxy), total_impressions
 *
 * Supported filters: company_id, connection_id, campaign_id, date_preset,
 *                    date_start, date_stop, sort_by, sort_direction
 */
final class CreativeAnalyticsController extends Controller
{
    public function __construct(
        private readonly MarketingKpiEngine $engine,
        private readonly GenerateReportAction $reportAction,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filter = IntelligenceFilterDto::fromRequest($request);
        $sortBy = $this->allowedSort($request->query('sort_by', 'total_revenue'));
        $sortDir = $request->query('sort_direction', 'desc') === 'asc' ? 'asc' : 'desc';
        $perPage = min((int) $request->query('per_page', 20), 200);
        $page = max(1, (int) $request->query('page', 1));

        $result = $this->engine->creativeBreakdown($filter, $sortBy, $sortDir, $perPage, $page);

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

        return $this->reportAction->creativeReport($filter, $format, $actorId);
    }

    private function allowedSort(string $value): string
    {
        $allowed = ['total_revenue', 'total_spend', 'total_purchases', 'total_clicks', 'total_impressions', 'total_leads'];

        return in_array($value, $allowed, true) ? $value : 'total_revenue';
    }
}
