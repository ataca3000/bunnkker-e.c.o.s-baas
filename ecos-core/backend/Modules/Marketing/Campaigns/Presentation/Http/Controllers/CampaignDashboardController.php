<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Modules\Marketing\Campaigns\Domain\Models\Campaign;
use Modules\Marketing\Campaigns\Domain\Models\CampaignAd;
use Modules\Marketing\Campaigns\Domain\Models\CampaignAdSet;
use Modules\Marketing\Campaigns\Domain\Models\CampaignCreative;

/**
 * Executive Campaign Dashboard.
 *
 * Returns two logical sections:
 *  - structure: entity counts, last sync, status breakdown
 *  - performance: KPI totals and daily trend (insight snapshots only)
 */
final class CampaignDashboardController extends Controller
{
    /** GET /marketing/campaigns/dashboard */
    public function index(Request $request): JsonResponse
    {
        $days = min((int) $request->query('days', 30), 365);
        $dateFrom = now()->subDays($days)->toDateString();
        $dateTo = now()->toDateString();
        $companyId = $request->query('company_id');

        // ── Structure ─────────────────────────────────────────────────────────

        $campaignBase = Campaign::when($companyId, fn ($q) => $q->where('company_id', $companyId));
        $campaignIds = (clone $campaignBase)->select('id');

        $totalCampaigns = (clone $campaignBase)->count();
        $activeCampaigns = (clone $campaignBase)->where('status', 'ACTIVE')->count();
        $totalAdSets = CampaignAdSet::whereIn('marketing_campaign_id', $campaignIds)->count();
        $totalAds = CampaignAd::whereIn('marketing_campaign_id', $campaignIds)->count();
        $totalCreatives = CampaignCreative::whereIn('marketing_campaign_id', $campaignIds)->count();
        $lastStructureSync = (clone $campaignBase)->max('last_synced_at');

        $statusDistribution = (clone $campaignBase)
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->get()
            ->pluck('count', 'status');

        // ── Performance (insight snapshots) ───────────────────────────────────

        $insightBase = DB::table('marketing_campaign_insights')
            ->where('level', 'campaign')
            ->whereDate('date_start', '>=', $dateFrom)
            ->whereDate('date_stop', '<=', $dateTo)
            ->when($companyId, fn ($q) => $q->whereIn(
                'marketing_campaign_id',
                fn ($sub) => $sub->select('id')->from('marketing_campaigns')->where('company_id', $companyId),
            ));

        $kpis = (clone $insightBase)
            ->selectRaw('
                SUM(spend)             as total_spend,
                SUM(impressions)       as total_impressions,
                SUM(clicks)            as total_clicks,
                SUM(reach)             as total_reach,
                SUM(purchases)         as total_purchases,
                SUM(purchase_value)    as total_revenue,
                SUM(leads)             as total_leads,
                SUM(messages)          as total_messages,
                AVG(ctr)               as avg_ctr,
                AVG(unique_ctr)        as avg_unique_ctr,
                AVG(cpc)               as avg_cpc,
                AVG(cpm)               as avg_cpm,
                AVG(cpa)               as avg_cpa,
                AVG(roas)              as avg_roas,
                AVG(roas_website)      as avg_roas_website,
                MAX(synced_at)         as last_insights_sync,
                COUNT(DISTINCT marketing_campaign_id) as campaign_count
            ')
            ->first();

        $dailyTrend = (clone $insightBase)
            ->selectRaw('
                date_start,
                SUM(spend)          as spend,
                SUM(impressions)    as impressions,
                SUM(purchases)      as purchases,
                SUM(purchase_value) as revenue,
                AVG(ctr)            as ctr,
                AVG(cpc)            as cpc,
                AVG(roas)           as roas
            ')
            ->groupBy('date_start')
            ->orderBy('date_start')
            ->get();

        // Sync health: how stale is the last insights sync?
        $lastSync = $kpis?->last_insights_sync;
        $syncAgeHours = $lastSync ? now()->diffInHours($lastSync) : null;
        $syncHealth = match (true) {
            $lastSync === null => 'never',
            $syncAgeHours <= 1 => 'fresh',
            $syncAgeHours <= 24 => 'recent',
            default => 'stale',
        };

        return response()->json([
            'structure' => [
                'campaign_count' => $totalCampaigns,
                'active_campaigns' => $activeCampaigns,
                'ad_set_count' => $totalAdSets,
                'ad_count' => $totalAds,
                'creative_count' => $totalCreatives,
                'last_structure_sync' => $lastStructureSync,
                'status_distribution' => $statusDistribution,
            ],
            'performance' => [
                'kpis' => [
                    'total_spend' => $kpis?->total_spend,
                    'total_impressions' => $kpis?->total_impressions,
                    'total_clicks' => $kpis?->total_clicks,
                    'total_reach' => $kpis?->total_reach,
                    'total_purchases' => $kpis?->total_purchases,
                    'total_revenue' => $kpis?->total_revenue,
                    'total_leads' => $kpis?->total_leads,
                    'total_messages' => $kpis?->total_messages,
                    'avg_ctr' => $kpis?->avg_ctr,
                    'avg_unique_ctr' => $kpis?->avg_unique_ctr,
                    'avg_cpc' => $kpis?->avg_cpc,
                    'avg_cpm' => $kpis?->avg_cpm,
                    'avg_cpa' => $kpis?->avg_cpa,
                    'avg_roas' => $kpis?->avg_roas,
                    'avg_roas_website' => $kpis?->avg_roas_website,
                    'campaign_count' => $kpis?->campaign_count ?? 0,
                ],
                'daily_trend' => $dailyTrend,
                'last_insights_sync' => $lastSync,
                'sync_health' => $syncHealth,
            ],
            'period' => [
                'days' => $days,
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
            ],
        ]);
    }
}
