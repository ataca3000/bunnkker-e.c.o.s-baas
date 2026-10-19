<?php

declare(strict_types=1);

namespace Modules\Marketing\Intelligence\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\Intelligence\Application\Dto\IntelligenceFilterDto;
use Modules\Marketing\Intelligence\Application\Services\MarketingKpiEngine;

/**
 * Performance Trends — time-series data for all key metrics.
 *
 * Returns one data point per period (day / week / month) with:
 * spend, revenue, ROAS, CPA, CTR, CPC, CPM, purchases, leads, impressions, clicks, reach.
 *
 * GET /marketing/intelligence/trends
 *
 * Query params:
 *   granularity  day | week | month      (default: day)
 *   level        campaign | adset | ad   (default: campaign)
 *   metric       (reserved — returns all metrics always)
 *   + all IntelligenceFilterDto params (company_id, connection_id, campaign_id,
 *     date_preset, date_start, date_stop, status, ...)
 */
final class PerformanceTrendsController extends Controller
{
    public function __construct(
        private readonly MarketingKpiEngine $engine,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filter = IntelligenceFilterDto::fromRequest($request);
        $granularity = $this->allowedGranularity($request->query('granularity', 'day'));
        $level = $this->allowedLevel($request->query('level', 'campaign'));

        $data = $this->engine->trends($filter, $granularity, $level);

        [$start, $end] = $filter->resolvedDates();

        // Compute summary totals over the trend period
        $totalSpend = array_sum(array_column($data, 'spend'));
        $totalRevenue = array_sum(array_column($data, 'revenue'));

        return response()->json([
            'data' => $data,
            'meta' => [
                'granularity' => $granularity,
                'level' => $level,
                'date_from' => $start,
                'date_to' => $end,
                'days' => $filter->periodDays(),
                'data_points' => count($data),
                'summary' => [
                    'total_spend' => round($totalSpend, 2),
                    'total_revenue' => round($totalRevenue, 2),
                    'total_purchases' => array_sum(array_column($data, 'purchases')),
                    'total_leads' => array_sum(array_column($data, 'leads')),
                    'avg_roas' => $totalSpend > 0 ? round($totalRevenue / $totalSpend, 4) : null,
                ],
            ],
        ]);
    }

    /**
     * Multi-metric comparison for two periods side-by-side.
     * Returns current period data + previous period data in parallel arrays.
     *
     * GET /marketing/intelligence/trends/compare
     */
    public function compare(Request $request): JsonResponse
    {
        $filter = IntelligenceFilterDto::fromRequest($request);
        $granularity = $this->allowedGranularity($request->query('granularity', 'day'));
        $level = $this->allowedLevel($request->query('level', 'campaign'));

        $current = $this->engine->trends($filter, $granularity, $level);
        $previous = $this->engine->trends($filter->previousPeriodFilter(), $granularity, $level);

        [$currentStart, $currentEnd] = $filter->resolvedDates();
        $prevFilter = $filter->previousPeriodFilter();
        [$prevStart, $prevEnd] = $prevFilter->resolvedDates();

        return response()->json([
            'current' => [
                'period' => ['from' => $currentStart, 'to' => $currentEnd],
                'data' => $current,
            ],
            'previous' => [
                'period' => ['from' => $prevStart, 'to' => $prevEnd],
                'data' => $previous,
            ],
            'granularity' => $granularity,
        ]);
    }

    private function allowedGranularity(string $value): string
    {
        return in_array($value, ['day', 'week', 'month'], true) ? $value : 'day';
    }

    private function allowedLevel(string $value): string
    {
        return in_array($value, ['campaign', 'adset', 'ad'], true) ? $value : 'campaign';
    }
}
