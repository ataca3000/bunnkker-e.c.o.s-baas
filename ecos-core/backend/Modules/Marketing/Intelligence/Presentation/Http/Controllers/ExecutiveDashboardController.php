<?php

declare(strict_types=1);

namespace Modules\Marketing\Intelligence\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\Campaigns\Domain\Models\Campaign;
use Modules\Marketing\Intelligence\Application\Dto\IntelligenceFilterDto;
use Modules\Marketing\Intelligence\Application\Services\MarketingHealthScoreService;
use Modules\Marketing\Intelligence\Application\Services\MarketingKpiEngine;

/**
 * Executive Marketing Dashboard.
 *
 * Returns a single JSON payload covering all executive-level KPIs, growth,
 * health score, top/worst campaigns, and top/worst creatives.
 *
 * Marketing managers use this as their single-screen overview without
 * ever opening Meta Business Manager.
 *
 * GET /marketing/intelligence/dashboard
 */
final class ExecutiveDashboardController extends Controller
{
    public function __construct(
        private readonly MarketingKpiEngine $engine,
        private readonly MarketingHealthScoreService $healthScore,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filter = IntelligenceFilterDto::fromRequest($request);

        [$start, $end] = $filter->resolvedDates();

        // All calls share the same filter → KPI Engine caches individually
        $kpis = $this->engine->kpis($filter);
        $growth = $this->engine->growth($filter);
        $health = $this->healthScore->compute($filter);

        $topCampaigns = $this->engine->topEntities($filter, 'campaign', 5, 'roas');
        $worstCampaigns = $this->engine->worstEntities($filter, 'campaign', 5);

        // Attach campaign names to ranked entities
        $topCampaigns = $this->attachCampaignNames($topCampaigns, 'entity_id');
        $worstCampaigns = $this->attachCampaignNames($worstCampaigns, 'entity_id');

        $topCreatives = $this->engine->creativeBreakdown($filter, 'total_revenue', 'desc', 5, 1);
        $worstCreatives = $this->engine->creativeBreakdown($filter, 'total_spend', 'asc', 5, 1);

        return response()->json([
            'period' => [
                'date_from' => $start,
                'date_to' => $end,
                'days' => $filter->periodDays(),
                'date_preset' => $filter->datePreset,
            ],
            'kpis' => [
                'spend' => $kpis['spend'],
                'revenue' => $kpis['revenue'],
                'roas' => $kpis['roas'],
                'cpa' => $kpis['cpa'],
                'ctr' => $kpis['ctr'],
                'ctr_pct' => $kpis['ctr'] !== null ? round($kpis['ctr'] * 100, 4) : null,
                'cpc' => $kpis['cpc'],
                'cpm' => $kpis['cpm'],
                'purchases' => $kpis['purchases'],
                'leads' => $kpis['leads'],
                'impressions' => $kpis['impressions'],
                'clicks' => $kpis['clicks'],
                'reach' => $kpis['reach'],
                'messages' => $kpis['messages'],
                'unique_clicks' => $kpis['unique_clicks'],
                'engagement' => $kpis['engagement'],
            ],
            'growth' => $growth,
            'health' => $health,
            'top_campaigns' => array_slice($topCampaigns, 0, 1),
            'worst_campaigns' => array_slice($worstCampaigns, 0, 1),
            'top_5_campaigns' => $topCampaigns,
            'worst_5_campaigns' => $worstCampaigns,
            'top_creative' => $topCreatives['data'][0] ?? null,
            'worst_creative' => $worstCreatives['data'][0] ?? null,
            'top_5_creatives' => $topCreatives['data'],
        ]);
    }

    /**
     * Attach campaign name to entity rows by fetching from campaigns table.
     *
     * @param  list<array<string, mixed>>  $entities
     * @return list<array<string, mixed>>
     */
    private function attachCampaignNames(array $entities, string $idKey): array
    {
        if (empty($entities)) {
            return $entities;
        }

        $ids = array_unique(array_column($entities, $idKey));
        $campaigns = Campaign::whereIn('id', $ids)
            ->pluck('name', 'id');

        return array_map(function (array $entity) use ($campaigns, $idKey) {
            $entity['name'] = $campaigns[$entity[$idKey]] ?? null;

            return $entity;
        }, $entities);
    }
}
