<?php

declare(strict_types=1);

namespace Modules\Marketing\Initiatives\Application\Services;

use Illuminate\Support\Facades\DB;
use Modules\Marketing\Campaigns\Domain\Models\Campaign;
use Modules\Marketing\Initiatives\Domain\Models\MarketingInitiative;

/**
 * Initiative KPI Engine.
 *
 * Aggregates campaign-level insight snapshots to compute
 * initiative-level business metrics.
 *
 * Revenue / Profit / ROAS are PLACEHOLDERS — architecture only.
 * Future: Marketing Finance module will fill these.
 */
final class InitiativeKpiService
{
    /**
     * @return array<string, mixed>
     */
    public function forInitiative(
        MarketingInitiative $initiative,
        string $datePreset = 'last_30d',
    ): array {
        $dateRange = $this->dateRangeFromPreset($datePreset);
        $campaignIds = Campaign::where('marketing_initiative_id', $initiative->id)->pluck('id');

        if ($campaignIds->isEmpty()) {
            return $this->emptyKpis($initiative);
        }

        // Aggregate from insight snapshots
        $agg = DB::table('marketing_campaign_insights')
            ->whereIn('marketing_campaign_id', $campaignIds)
            ->where('level', 'campaign')
            ->whereBetween('date_start', [$dateRange['start'], $dateRange['end']])
            ->selectRaw('
                SUM(spend)       as total_spend,
                SUM(reach)       as total_reach,
                SUM(impressions) as total_impressions,
                AVG(ctr)         as avg_ctr,
                AVG(cpc)         as avg_cpc,
                AVG(cpm)         as avg_cpm,
                SUM(purchases)   as total_purchases,
                SUM(leads)       as total_leads,
                SUM(messages)    as total_messages,
                SUM(clicks)      as total_clicks
            ')
            ->first();

        // Campaign status breakdown
        $statusBreakdown = Campaign::where('marketing_initiative_id', $initiative->id)
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        $totalCampaigns = $campaignIds->count();
        $activeCampaigns = (int) ($statusBreakdown['ACTIVE'] ?? 0);
        $pausedCampaigns = (int) ($statusBreakdown['PAUSED'] ?? 0);

        $budgetUtilization = ($initiative->budget && $agg?->total_spend)
            ? round(((float) $agg->total_spend / (float) $initiative->budget) * 100, 1)
            : null;

        return [
            'campaign_count' => $totalCampaigns,
            'active_campaigns' => $activeCampaigns,
            'paused_campaigns' => $pausedCampaigns,
            'status_breakdown' => $statusBreakdown,

            // Spend & Budget
            'budget' => $initiative->budget,
            'total_spend' => $agg?->total_spend,
            'budget_utilization' => $budgetUtilization,

            // Delivery
            'total_reach' => $agg?->total_reach,
            'total_impressions' => $agg?->total_impressions,
            'total_clicks' => $agg?->total_clicks,

            // Efficiency
            'avg_ctr' => $agg?->avg_ctr,
            'avg_cpc' => $agg?->avg_cpc,
            'avg_cpm' => $agg?->avg_cpm,

            // Conversions
            'total_purchases' => $agg?->total_purchases,
            'total_leads' => $agg?->total_leads,
            'total_messages' => $agg?->total_messages,

            // Placeholders — Marketing Finance module (future)
            'estimated_revenue' => null,
            'estimated_profit' => null,
            'roas' => null,

            // Timeline
            'days_remaining' => $initiative->daysRemaining(),
            'progress_percent' => $initiative->progressPercent(),

            // Period
            'period' => [
                'preset' => $datePreset,
                'date_from' => $dateRange['start'],
                'date_to' => $dateRange['end'],
            ],
        ];
    }

    /**
     * Aggregate KPIs across all initiatives for the Executive Dashboard.
     *
     * @return array<string, mixed>
     */
    public function aggregateAll(string $datePreset = 'last_30d', ?string $companyId = null): array
    {
        $dateRange = $this->dateRangeFromPreset($datePreset);

        $initiativeQuery = MarketingInitiative::query()
            ->when($companyId, fn ($q) => $q->where('company_id', $companyId));

        $totalInitiatives = (clone $initiativeQuery)->count();
        $activeInitiatives = (clone $initiativeQuery)->where('status', 'active')->count();

        $campaignIds = Campaign::whereHas('initiative', function ($q) use ($companyId) {
            $q->when($companyId, fn ($q2) => $q2->where('company_id', $companyId));
        })->pluck('id');

        $agg = DB::table('marketing_campaign_insights')
            ->whereIn('marketing_campaign_id', $campaignIds)
            ->where('level', 'campaign')
            ->whereBetween('date_start', [$dateRange['start'], $dateRange['end']])
            ->selectRaw('SUM(spend) as total_spend, SUM(reach) as total_reach, SUM(impressions) as total_impressions, AVG(ctr) as avg_ctr, SUM(purchases) as total_purchases, SUM(leads) as total_leads')
            ->first();

        return [
            'total_initiatives' => $totalInitiatives,
            'active_initiatives' => $activeInitiatives,
            'total_spend' => $agg?->total_spend,
            'total_reach' => $agg?->total_reach,
            'total_impressions' => $agg?->total_impressions,
            'avg_ctr' => $agg?->avg_ctr,
            'total_purchases' => $agg?->total_purchases,
            'total_leads' => $agg?->total_leads,
        ];
    }

    /** @return array<string, mixed> */
    private function emptyKpis(MarketingInitiative $initiative): array
    {
        return [
            'campaign_count' => 0,
            'active_campaigns' => 0,
            'paused_campaigns' => 0,
            'status_breakdown' => [],
            'budget' => $initiative->budget,
            'total_spend' => null,
            'budget_utilization' => null,
            'total_reach' => null,
            'total_impressions' => null,
            'total_clicks' => null,
            'avg_ctr' => null,
            'avg_cpc' => null,
            'avg_cpm' => null,
            'total_purchases' => null,
            'total_leads' => null,
            'total_messages' => null,
            'estimated_revenue' => null,
            'estimated_profit' => null,
            'roas' => null,
            'days_remaining' => $initiative->daysRemaining(),
            'progress_percent' => $initiative->progressPercent(),
            'period' => ['preset' => 'last_30d'],
        ];
    }

    /** @return array{start: string, end: string} */
    private function dateRangeFromPreset(string $preset): array
    {
        return match ($preset) {
            'last_7d' => ['start' => now()->subDays(7)->toDateString(),   'end' => now()->toDateString()],
            'last_90d' => ['start' => now()->subDays(90)->toDateString(),  'end' => now()->toDateString()],
            'last_180d' => ['start' => now()->subDays(180)->toDateString(), 'end' => now()->toDateString()],
            'this_month' => ['start' => now()->startOfMonth()->toDateString(), 'end' => now()->toDateString()],
            default => ['start' => now()->subDays(30)->toDateString(),  'end' => now()->toDateString()],
        };
    }
}
