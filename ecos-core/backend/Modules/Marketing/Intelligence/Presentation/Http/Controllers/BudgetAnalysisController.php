<?php

declare(strict_types=1);

namespace Modules\Marketing\Intelligence\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Modules\Marketing\Intelligence\Application\Dto\IntelligenceFilterDto;
use Modules\Marketing\Intelligence\Application\Services\MarketingKpiEngine;

/**
 * Budget Analysis — budget distribution, spend share, remaining budget, overspending alerts.
 *
 * GET /marketing/intelligence/budget
 *
 * Returns:
 *  - summary: total budget, total spend, remaining, utilization %, overspending count
 *  - campaigns: per-campaign budget/spend breakdown with share percentages
 *  - overspending_alerts: campaigns that have exceeded budget by > 5%
 *
 * Supports all standard IntelligenceFilterDto params.
 */
final class BudgetAnalysisController extends Controller
{
    public function __construct(
        private readonly MarketingKpiEngine $engine,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filter = IntelligenceFilterDto::fromRequest($request);

        $analysis = $this->engine->budgetAnalysis($filter);

        [$start, $end] = $filter->resolvedDates();

        // Ad Set budget breakdown (optional, only if ?include_ad_sets=true)
        $adSets = [];
        if ($request->boolean('include_ad_sets')) {
            $adSets = $this->adSetBudgets($filter);
        }

        return response()->json([
            'period' => [
                'date_from' => $start,
                'date_to' => $end,
                'date_preset' => $filter->datePreset,
            ],
            'summary' => $analysis['summary'],
            'campaigns' => $analysis['campaigns'],
            'ad_sets' => $adSets,
            'overspending_alerts' => $analysis['overspending_alerts'],
        ]);
    }

    /**
     * Ad-set level budget breakdown.
     *
     * @return list<array<string, mixed>>
     */
    private function adSetBudgets(IntelligenceFilterDto $filter): array
    {
        [$start, $end] = $filter->resolvedDates();

        $rows = DB::table('marketing_campaign_insights as ins')
            ->join('marketing_campaign_ad_sets as ads', 'ads.id', '=', 'ins.marketing_campaign_ad_set_id')
            ->join('marketing_campaigns as c', 'c.id', '=', 'ins.marketing_campaign_id')
            ->selectRaw('
                ads.id,
                ads.name,
                ads.status,
                ads.daily_budget,
                ads.lifetime_budget,
                ads.marketing_campaign_id,
                c.name as campaign_name,
                SUM(ins.spend) as total_spend
            ')
            ->where('ins.level', 'adset')
            ->whereBetween('ins.date_start', [$start, $end])
            ->when($filter->connectionId, fn ($q) => $q->where('ins.marketing_connection_id', $filter->connectionId))
            ->when($filter->campaignId, fn ($q) => $q->where('ins.marketing_campaign_id', $filter->campaignId))
            ->when($filter->companyId, fn ($q) => $q->where('c.company_id', $filter->companyId))
            ->groupBy('ads.id', 'ads.name', 'ads.status', 'ads.daily_budget', 'ads.lifetime_budget', 'ads.marketing_campaign_id', 'c.name')
            ->orderByDesc('total_spend')
            ->get();

        $totalSpend = (float) $rows->sum('total_spend');

        return $rows->map(function ($row) use ($totalSpend) {
            $spend = (float) ($row->total_spend ?? 0);
            $budget = (float) ($row->lifetime_budget ?? ($row->daily_budget ?? 0));

            return [
                'id' => $row->id,
                'name' => $row->name,
                'status' => $row->status,
                'campaign_id' => $row->marketing_campaign_id,
                'campaign_name' => $row->campaign_name,
                'budget_type' => $row->lifetime_budget ? 'LIFETIME' : ($row->daily_budget ? 'DAILY' : 'NONE'),
                'budget' => $budget,
                'spend' => $spend,
                'remaining' => $budget > 0 ? max(0, $budget - $spend) : null,
                'utilization_pct' => $budget > 0 ? round($spend / $budget * 100, 2) : null,
                'spend_share_pct' => $totalSpend > 0 ? round($spend / $totalSpend * 100, 2) : null,
                'is_overspending' => $budget > 0 && $spend > $budget * 1.05,
            ];
        })->all();
    }
}
