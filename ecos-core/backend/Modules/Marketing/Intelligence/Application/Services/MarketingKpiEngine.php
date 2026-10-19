<?php

declare(strict_types=1);

namespace Modules\Marketing\Intelligence\Application\Services;

use BadMethodCallException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Modules\Marketing\Intelligence\Application\Dto\IntelligenceFilterDto;

/**
 * Centralized, cached KPI calculation engine for the Marketing Intelligence layer.
 *
 * All dashboard and analytics controllers MUST use this service for aggregated KPI data.
 * No controller or action should query marketing_campaign_insights directly for aggregates.
 *
 * Cache strategy: 15-minute TTL keyed by filter hash.
 * Cache is tagged by company_id for targeted invalidation.
 *
 * NOTE: Deduplication — insights are append-only (multiple rows per campaign+day possible).
 * This engine does NOT deduplicate to keep queries fast. For accurate totals, ensure syncs
 * run once per day. A future `DISTINCT ON` migration can address this if needed.
 */
final class MarketingKpiEngine
{
    private const CACHE_TTL_SECONDS = 900; // 15 minutes

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Aggregate KPIs for the given filter period.
     *
     * @return array{
     *   spend: float, revenue: float, roas: float|null, cpa: float|null,
     *   ctr: float|null, cpc: float|null, cpm: float|null,
     *   purchases: int, leads: int, impressions: int, clicks: int,
     *   reach: int, messages: int, unique_clicks: int, engagement: int
     * }
     */
    public function kpis(IntelligenceFilterDto $filter, string $level = 'campaign'): array
    {
        $key = $filter->cacheKey("kpis:{$level}");

        return Cache::remember($key, self::CACHE_TTL_SECONDS, function () use ($filter, $level) {
            return $this->computeKpis($filter, $level);
        });
    }

    /**
     * Growth percentages vs the prior period of equal length.
     *
     * @return array{
     *   spend_growth: float|null, revenue_growth: float|null,
     *   purchases_growth: float|null, leads_growth: float|null,
     *   roas_growth: float|null, impressions_growth: float|null
     * }
     */
    public function growth(IntelligenceFilterDto $filter, string $level = 'campaign'): array
    {
        $key = $filter->cacheKey("growth:{$level}");

        return Cache::remember($key, self::CACHE_TTL_SECONDS, function () use ($filter, $level) {
            $current = $this->computeKpis($filter, $level);
            $previous = $this->computeKpis($filter->previousPeriodFilter(), $level);

            return [
                'spend_growth' => $this->growthPct($current['spend'], $previous['spend']),
                'revenue_growth' => $this->growthPct($current['revenue'], $previous['revenue']),
                'purchases_growth' => $this->growthPct($current['purchases'], $previous['purchases']),
                'leads_growth' => $this->growthPct($current['leads'], $previous['leads']),
                'roas_growth' => $this->growthPct($current['roas'] ?? 0, $previous['roas'] ?? 0),
                'impressions_growth' => $this->growthPct($current['impressions'], $previous['impressions']),
            ];
        });
    }

    /**
     * Top N campaigns/ads ranked by ROAS descending.
     *
     * @return list<array<string, mixed>>
     */
    public function topEntities(
        IntelligenceFilterDto $filter,
        string $level = 'campaign',
        int $limit = 5,
        string $sortMetric = 'roas',
    ): array {
        $key = $filter->cacheKey("top:{$level}:{$limit}:{$sortMetric}");

        return Cache::remember($key, self::CACHE_TTL_SECONDS, function () use ($filter, $level, $limit, $sortMetric) {
            return $this->queryRankedEntities($filter, $level, $limit, $sortMetric, 'desc');
        });
    }

    /**
     * Worst N campaigns/ads (lowest ROAS, highest CPA).
     *
     * @return list<array<string, mixed>>
     */
    public function worstEntities(
        IntelligenceFilterDto $filter,
        string $level = 'campaign',
        int $limit = 5,
    ): array {
        $key = $filter->cacheKey("worst:{$level}:{$limit}");

        return Cache::remember($key, self::CACHE_TTL_SECONDS, function () use ($filter, $level, $limit) {
            // Worst = highest spend but lowest ROAS (money lost)
            return $this->queryRankedEntities($filter, $level, $limit, 'roas', 'asc');
        });
    }

    /**
     * Paginated campaign-level breakdown table.
     *
     * @return array{data: list<array<string, mixed>>, total: int}
     */
    public function campaignBreakdown(
        IntelligenceFilterDto $filter,
        string $sortBy = 'total_spend',
        string $sortDirection = 'desc',
        ?string $groupBy = null,
        int $perPage = 20,
        int $page = 1,
    ): array {
        [$start, $end] = $filter->resolvedDates();

        $query = DB::table('marketing_campaign_insights as ins')
            ->join('marketing_campaigns as c', 'c.id', '=', 'ins.marketing_campaign_id')
            ->select([
                'c.id',
                'c.name',
                DB::raw('c.status::text as status'),
                DB::raw('c.objective::text as objective'),
                'c.daily_budget',
                'c.lifetime_budget',
                'c.budget_remaining',
                DB::raw('SUM(ins.spend)          as total_spend'),
                DB::raw('SUM(ins.purchase_value) as total_revenue'),
                DB::raw('SUM(ins.impressions)    as total_impressions'),
                DB::raw('SUM(ins.clicks)         as total_clicks'),
                DB::raw('SUM(ins.purchases)      as total_purchases'),
                DB::raw('SUM(ins.leads)          as total_leads'),
                DB::raw('SUM(ins.messages)       as total_messages'),
                DB::raw('SUM(ins.reach)          as total_reach'),
                DB::raw('SUM(ins.unique_clicks)  as total_unique_clicks'),
                DB::raw('SUM(ins.engagement)     as total_engagement'),
                DB::raw('MAX(ins.synced_at)      as last_synced_at'),
            ])
            ->where('ins.level', 'campaign')
            ->whereBetween('ins.date_start', [$start, $end])
            ->when($filter->connectionId, fn ($q) => $q->where('ins.marketing_connection_id', $filter->connectionId))
            ->when($filter->campaignId, fn ($q) => $q->where('ins.marketing_campaign_id', $filter->campaignId))
            ->when($filter->companyId, fn ($q) => $q->where('c.company_id', $filter->companyId))
            ->when($filter->status, fn ($q) => $q->where(DB::raw('c.status::text'), $filter->status))
            ->when($filter->adAccountId, fn ($q) => $q->where('c.external_account_id', $filter->adAccountId))
            ->groupBy('c.id', 'c.name', 'c.status', 'c.objective', 'c.daily_budget', 'c.lifetime_budget', 'c.budget_remaining');

        if ($groupBy && in_array($groupBy, ['status', 'objective'], true)) {
            $query->groupBy(DB::raw("c.{$groupBy}"));
        }

        $allowed = ['total_spend', 'total_revenue', 'total_purchases', 'total_leads', 'total_clicks', 'total_impressions', 'total_reach'];
        $col = in_array($sortBy, $allowed, true) ? $sortBy : 'total_spend';
        $dir = $sortDirection === 'asc' ? 'asc' : 'desc';

        $total = (clone $query)->getCountForPagination();
        $offset = ($page - 1) * $perPage;

        $rows = (clone $query)
            ->orderBy(DB::raw("COALESCE({$col}, 0)"), $dir)
            ->limit($perPage)
            ->offset($offset)
            ->get();

        $data = $rows->map(function ($row, $rank) use ($page, $perPage) {
            $spend = (float) ($row->total_spend ?? 0);
            $revenue = (float) ($row->total_revenue ?? 0);
            $imp = (int) ($row->total_impressions ?? 0);
            $clicks = (int) ($row->total_clicks ?? 0);
            $purchases = (int) ($row->total_purchases ?? 0);

            return [
                'rank' => ($page - 1) * $perPage + $rank + 1,
                'id' => $row->id,
                'name' => $row->name,
                'status' => $row->status,
                'objective' => $row->objective,
                'daily_budget' => $row->daily_budget,
                'lifetime_budget' => $row->lifetime_budget,
                'budget_remaining' => $row->budget_remaining,
                'spend' => $spend,
                'revenue' => $revenue,
                'roas' => $spend > 0 ? round($revenue / $spend, 4) : null,
                'roi' => $spend > 0 ? round(($revenue - $spend) / $spend * 100, 2) : null,
                'cpa' => $purchases > 0 ? round($spend / $purchases, 4) : null,
                'ctr' => $imp > 0 ? round($clicks / $imp, 6) : null,
                'cpc' => $clicks > 0 ? round($spend / $clicks, 4) : null,
                'cpm' => $imp > 0 ? round($spend / $imp * 1000, 4) : null,
                'purchases' => $purchases,
                'leads' => (int) ($row->total_leads ?? 0),
                'impressions' => $imp,
                'clicks' => $clicks,
                'reach' => (int) ($row->total_reach ?? 0),
                'messages' => (int) ($row->total_messages ?? 0),
                'unique_clicks' => (int) ($row->total_unique_clicks ?? 0),
                'engagement' => (int) ($row->total_engagement ?? 0),
                'last_synced_at' => $row->last_synced_at,
            ];
        })->all();

        return ['data' => $data, 'total' => $total];
    }

    /**
     * Ad-level breakdown table.
     *
     * @return array{data: list<array<string, mixed>>, total: int}
     */
    public function adBreakdown(
        IntelligenceFilterDto $filter,
        string $sortBy = 'total_spend',
        string $sortDirection = 'desc',
        int $perPage = 20,
        int $page = 1,
    ): array {
        [$start, $end] = $filter->resolvedDates();

        $query = DB::table('marketing_campaign_insights as ins')
            ->join('marketing_campaign_ads as ad', 'ad.id', '=', 'ins.marketing_campaign_ad_id')
            ->join('marketing_campaigns as c', 'c.id', '=', 'ins.marketing_campaign_id')
            ->select([
                'ad.id',
                'ad.name',
                DB::raw('ad.status::text as status'),
                'ad.marketing_campaign_id',
                'c.name as campaign_name',
                DB::raw('SUM(ins.spend)          as total_spend'),
                DB::raw('SUM(ins.purchase_value) as total_revenue'),
                DB::raw('SUM(ins.impressions)    as total_impressions'),
                DB::raw('SUM(ins.clicks)         as total_clicks'),
                DB::raw('SUM(ins.purchases)      as total_purchases'),
                DB::raw('SUM(ins.leads)          as total_leads'),
                DB::raw('SUM(ins.reach)          as total_reach'),
                DB::raw('SUM(ins.unique_clicks)  as total_unique_clicks'),
                DB::raw('SUM(ins.engagement)     as total_engagement'),
                DB::raw('MAX(ins.synced_at)      as last_synced_at'),
            ])
            ->where('ins.level', 'ad')
            ->whereBetween('ins.date_start', [$start, $end])
            ->when($filter->connectionId, fn ($q) => $q->where('ins.marketing_connection_id', $filter->connectionId))
            ->when($filter->campaignId, fn ($q) => $q->where('ins.marketing_campaign_id', $filter->campaignId))
            ->when($filter->adSetId, fn ($q) => $q->where('ins.marketing_campaign_ad_set_id', $filter->adSetId))
            ->when($filter->companyId, fn ($q) => $q->where('c.company_id', $filter->companyId))
            ->when($filter->status, fn ($q) => $q->where(DB::raw('ad.status::text'), $filter->status))
            ->groupBy('ad.id', 'ad.name', 'ad.status', 'ad.marketing_campaign_id', 'c.name');

        $allowed = ['total_spend', 'total_revenue', 'total_purchases', 'total_leads', 'total_clicks', 'total_impressions'];
        $col = in_array($sortBy, $allowed, true) ? $sortBy : 'total_spend';
        $dir = $sortDirection === 'asc' ? 'asc' : 'desc';

        $total = (clone $query)->getCountForPagination();
        $offset = ($page - 1) * $perPage;

        $rows = (clone $query)
            ->orderBy(DB::raw("COALESCE({$col}, 0)"), $dir)
            ->limit($perPage)
            ->offset($offset)
            ->get();

        $data = $rows->map(function ($row, $rank) use ($page, $perPage) {
            $spend = (float) ($row->total_spend ?? 0);
            $revenue = (float) ($row->total_revenue ?? 0);
            $imp = (int) ($row->total_impressions ?? 0);
            $clicks = (int) ($row->total_clicks ?? 0);
            $purchases = (int) ($row->total_purchases ?? 0);

            return [
                'rank' => ($page - 1) * $perPage + $rank + 1,
                'id' => $row->id,
                'name' => $row->name,
                'status' => $row->status,
                'campaign_id' => $row->marketing_campaign_id,
                'campaign_name' => $row->campaign_name,
                'spend' => $spend,
                'revenue' => $revenue,
                'roas' => $spend > 0 ? round($revenue / $spend, 4) : null,
                'roi' => $spend > 0 ? round(($revenue - $spend) / $spend * 100, 2) : null,
                'cpa' => $purchases > 0 ? round($spend / $purchases, 4) : null,
                'ctr' => $imp > 0 ? round($clicks / $imp, 6) : null,
                'cpc' => $clicks > 0 ? round($spend / $clicks, 4) : null,
                'cpm' => $imp > 0 ? round($spend / $imp * 1000, 4) : null,
                'purchases' => $purchases,
                'leads' => (int) ($row->total_leads ?? 0),
                'impressions' => $imp,
                'clicks' => $clicks,
                'reach' => (int) ($row->total_reach ?? 0),
                'unique_clicks' => (int) ($row->total_unique_clicks ?? 0),
                'engagement' => (int) ($row->total_engagement ?? 0),
                'last_synced_at' => $row->last_synced_at,
            ];
        })->all();

        return ['data' => $data, 'total' => $total];
    }

    /**
     * Creative-level performance ranking.
     *
     * @return array{data: list<array<string, mixed>>, total: int}
     */
    public function creativeBreakdown(
        IntelligenceFilterDto $filter,
        string $sortBy = 'total_revenue',
        string $sortDirection = 'desc',
        int $perPage = 20,
        int $page = 1,
    ): array {
        [$start, $end] = $filter->resolvedDates();

        $query = DB::table('marketing_campaign_insights as ins')
            ->join('marketing_campaign_creatives as cr', 'cr.marketing_campaign_ad_id', '=', 'ins.marketing_campaign_ad_id')
            ->join('marketing_campaigns as c', 'c.id', '=', 'ins.marketing_campaign_id')
            ->select([
                'cr.id',
                'cr.external_creative_id',
                DB::raw('cr.creative_type::text as creative_type'),
                'cr.headline',
                'cr.primary_text',
                'cr.call_to_action',
                'cr.image_url',
                'cr.video_url',
                'cr.thumbnail_url',
                'cr.image_hash',
                'cr.marketing_campaign_id',
                'c.name as campaign_name',
                DB::raw('SUM(ins.spend)          as total_spend'),
                DB::raw('SUM(ins.purchase_value) as total_revenue'),
                DB::raw('SUM(ins.impressions)    as total_impressions'),
                DB::raw('SUM(ins.clicks)         as total_clicks'),
                DB::raw('SUM(ins.purchases)      as total_purchases'),
                DB::raw('SUM(ins.leads)          as total_leads'),
                DB::raw('SUM(ins.reach)          as total_reach'),
                DB::raw('SUM(ins.unique_clicks)  as total_unique_clicks'),
                DB::raw('MAX(ins.synced_at)      as last_synced_at'),
            ])
            ->where('ins.level', 'ad')
            ->whereNotNull('ins.marketing_campaign_ad_id')
            ->whereBetween('ins.date_start', [$start, $end])
            ->when($filter->connectionId, fn ($q) => $q->where('ins.marketing_connection_id', $filter->connectionId))
            ->when($filter->campaignId, fn ($q) => $q->where('ins.marketing_campaign_id', $filter->campaignId))
            ->when($filter->companyId, fn ($q) => $q->where('c.company_id', $filter->companyId))
            ->groupBy(
                'cr.id', 'cr.external_creative_id', 'cr.creative_type',
                'cr.headline', 'cr.primary_text', 'cr.call_to_action',
                'cr.image_url', 'cr.video_url', 'cr.thumbnail_url', 'cr.image_hash',
                'cr.marketing_campaign_id', 'c.name',
            );

        $allowed = ['total_spend', 'total_revenue', 'total_purchases', 'total_clicks', 'total_impressions', 'total_leads'];
        $col = in_array($sortBy, $allowed, true) ? $sortBy : 'total_revenue';
        $dir = $sortDirection === 'asc' ? 'asc' : 'desc';

        $total = (clone $query)->getCountForPagination();
        $offset = ($page - 1) * $perPage;

        $rows = (clone $query)
            ->orderBy(DB::raw("COALESCE({$col}, 0)"), $dir)
            ->limit($perPage)
            ->offset($offset)
            ->get();

        $data = $rows->map(function ($row, $rank) use ($page, $perPage) {
            $spend = (float) ($row->total_spend ?? 0);
            $revenue = (float) ($row->total_revenue ?? 0);
            $imp = (int) ($row->total_impressions ?? 0);
            $clicks = (int) ($row->total_clicks ?? 0);
            $purchases = (int) ($row->total_purchases ?? 0);

            return [
                'rank' => ($page - 1) * $perPage + $rank + 1,
                'id' => $row->id,
                'external_creative_id' => $row->external_creative_id,
                'creative_type' => $row->creative_type,
                'headline' => $row->headline,
                'primary_text' => $row->primary_text,
                'call_to_action' => $row->call_to_action,
                'image_url' => $row->image_url,
                'video_url' => $row->video_url,
                'thumbnail_url' => $row->thumbnail_url,
                'image_hash' => $row->image_hash,
                'campaign_id' => $row->marketing_campaign_id,
                'campaign_name' => $row->campaign_name,
                'spend' => $spend,
                'revenue' => $revenue,
                'roas' => $spend > 0 ? round($revenue / $spend, 4) : null,
                'cpa' => $purchases > 0 ? round($spend / $purchases, 4) : null,
                'ctr' => $imp > 0 ? round($clicks / $imp, 6) : null,
                'cpc' => $clicks > 0 ? round($spend / $clicks, 4) : null,
                'purchases' => $purchases,
                'leads' => (int) ($row->total_leads ?? 0),
                'impressions' => $imp,
                'clicks' => $clicks,
                'reach' => (int) ($row->total_reach ?? 0),
                'unique_clicks' => (int) ($row->total_unique_clicks ?? 0),
                'last_synced_at' => $row->last_synced_at,
            ];
        })->all();

        return ['data' => $data, 'total' => $total];
    }

    /**
     * Time-series trend data aggregated by granularity.
     *
     * @return list<array<string, mixed>>
     */
    public function trends(
        IntelligenceFilterDto $filter,
        string $granularity = 'day',   // day | week | month
        string $level = 'campaign',
    ): array {
        [$start, $end] = $filter->resolvedDates();

        $dateTrunc = match ($granularity) {
            'week' => "DATE_TRUNC('week', ins.date_start)",
            'month' => "DATE_TRUNC('month', ins.date_start)",
            default => 'ins.date_start',
        };

        $rows = DB::table('marketing_campaign_insights as ins')
            ->when(
                in_array($granularity, ['week', 'month'], true) || $filter->companyId || $filter->status,
                fn ($q) => $q->join('marketing_campaigns as c', 'c.id', '=', 'ins.marketing_campaign_id'),
            )
            ->selectRaw("
                {$dateTrunc} as period,
                SUM(ins.spend)          as spend,
                SUM(ins.purchase_value) as revenue,
                SUM(ins.impressions)    as impressions,
                SUM(ins.clicks)         as clicks,
                SUM(ins.purchases)      as purchases,
                SUM(ins.leads)          as leads,
                SUM(ins.messages)       as messages,
                SUM(ins.reach)          as reach
            ")
            ->where('ins.level', $level)
            ->whereBetween('ins.date_start', [$start, $end])
            ->when($filter->connectionId, fn ($q) => $q->where('ins.marketing_connection_id', $filter->connectionId))
            ->when($filter->campaignId, fn ($q) => $q->where('ins.marketing_campaign_id', $filter->campaignId))
            ->when($filter->companyId, fn ($q) => $q->where('c.company_id', $filter->companyId))
            ->when($filter->status, fn ($q) => $q->where(DB::raw('c.status::text'), $filter->status))
            ->groupByRaw($dateTrunc)
            ->orderByRaw($dateTrunc)
            ->get();

        return $rows->map(function ($row) {
            $spend = (float) ($row->spend ?? 0);
            $revenue = (float) ($row->revenue ?? 0);
            $imp = (int) ($row->impressions ?? 0);
            $clicks = (int) ($row->clicks ?? 0);
            $purchases = (int) ($row->purchases ?? 0);

            return [
                'period' => is_string($row->period) ? substr($row->period, 0, 10) : $row->period,
                'spend' => $spend,
                'revenue' => $revenue,
                'roas' => $spend > 0 ? round($revenue / $spend, 4) : null,
                'cpa' => $purchases > 0 ? round($spend / $purchases, 4) : null,
                'ctr' => $imp > 0 ? round($clicks / $imp, 6) : null,
                'cpc' => $clicks > 0 ? round($spend / $clicks, 4) : null,
                'cpm' => $imp > 0 ? round($spend / $imp * 1000, 4) : null,
                'purchases' => $purchases,
                'leads' => (int) ($row->leads ?? 0),
                'impressions' => $imp,
                'clicks' => $clicks,
                'reach' => (int) ($row->reach ?? 0),
                'messages' => (int) ($row->messages ?? 0),
            ];
        })->all();
    }

    /**
     * Budget utilization per campaign.
     *
     * @return array{
     *   summary: array<string, mixed>,
     *   campaigns: list<array<string, mixed>>,
     *   overspending_alerts: list<array<string, mixed>>
     * }
     */
    public function budgetAnalysis(IntelligenceFilterDto $filter): array
    {
        [$start, $end] = $filter->resolvedDates();

        $rows = DB::table('marketing_campaign_insights as ins')
            ->join('marketing_campaigns as c', 'c.id', '=', 'ins.marketing_campaign_id')
            ->selectRaw('
                c.id,
                c.name,
                c.status::text as status,
                c.daily_budget,
                c.lifetime_budget,
                c.budget_remaining,
                SUM(ins.spend)          as total_spend,
                SUM(ins.purchase_value) as total_revenue,
                SUM(ins.purchases)      as total_purchases
            ')
            ->where('ins.level', 'campaign')
            ->whereBetween('ins.date_start', [$start, $end])
            ->when($filter->connectionId, fn ($q) => $q->where('ins.marketing_connection_id', $filter->connectionId))
            ->when($filter->companyId, fn ($q) => $q->where('c.company_id', $filter->companyId))
            ->when($filter->status, fn ($q) => $q->where(DB::raw('c.status::text'), $filter->status))
            ->groupBy('c.id', 'c.name', 'c.status', 'c.daily_budget', 'c.lifetime_budget', 'c.budget_remaining')
            ->orderByDesc('total_spend')
            ->get();

        $totalBudget = 0.0;
        $totalSpend = 0.0;
        $campaigns = [];
        $alerts = [];

        foreach ($rows as $row) {
            $spend = (float) ($row->total_spend ?? 0);
            $budget = (float) ($row->lifetime_budget ?? ($row->daily_budget ?? 0));
            $remaining = (float) ($row->budget_remaining ?? max(0, $budget - $spend));
            $utilization = $budget > 0 ? round($spend / $budget * 100, 2) : null;

            $totalBudget += $budget;
            $totalSpend += $spend;

            $isOverspending = $budget > 0 && $spend > $budget * 1.05;

            $campaigns[] = [
                'id' => $row->id,
                'name' => $row->name,
                'status' => $row->status,
                'budget_type' => $row->lifetime_budget ? 'LIFETIME' : ($row->daily_budget ? 'DAILY' : 'NONE'),
                'budget' => $budget,
                'spend' => $spend,
                'remaining' => $remaining,
                'utilization_pct' => $utilization,
                'is_overspending' => $isOverspending,
                'revenue' => (float) ($row->total_revenue ?? 0),
                'purchases' => (int) ($row->total_purchases ?? 0),
            ];

            if ($isOverspending) {
                $alerts[] = [
                    'campaign_id' => $row->id,
                    'campaign_name' => $row->name,
                    'budget' => $budget,
                    'spend' => $spend,
                    'overspend_pct' => round(($spend - $budget) / $budget * 100, 2),
                ];
            }
        }

        // Attach spend share
        foreach ($campaigns as &$c) {
            $c['spend_share_pct'] = $totalSpend > 0 ? round($c['spend'] / $totalSpend * 100, 2) : null;
            $c['budget_share_pct'] = $totalBudget > 0 ? round($c['budget'] / $totalBudget * 100, 2) : null;
        }
        unset($c);

        return [
            'summary' => [
                'total_budget' => $totalBudget,
                'total_spend' => $totalSpend,
                'remaining_budget' => max(0, $totalBudget - $totalSpend),
                'budget_utilization_pct' => $totalBudget > 0 ? round($totalSpend / $totalBudget * 100, 2) : null,
                'overspending_count' => count($alerts),
            ],
            'campaigns' => $campaigns,
            'overspending_alerts' => $alerts,
        ];
    }

    /**
     * Invalidate cache entries for a given company (call after new sync completes).
     */
    public function invalidate(?string $companyId = null): void
    {
        // Laravel tag-based cache flush (requires Redis/Memcached)
        // Falls back gracefully if tags are not supported
        try {
            if ($companyId) {
                Cache::tags(["mkt_intel:company:{$companyId}"])->flush();
            } else {
                Cache::tags(['mkt_intel'])->flush();
            }
        } catch (BadMethodCallException) {
            // Tag-based cache not available — individual keys expire naturally via TTL
        }
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /**
     * @return array<string, mixed>
     */
    private function computeKpis(IntelligenceFilterDto $filter, string $level): array
    {
        [$start, $end] = $filter->resolvedDates();

        $needsCampaignJoin = $filter->companyId || $filter->status || $filter->adAccountId;

        $query = DB::table('marketing_campaign_insights as ins')
            ->when($needsCampaignJoin, fn ($q) => $q->join('marketing_campaigns as c', 'c.id', '=', 'ins.marketing_campaign_id'))
            ->selectRaw('
                COALESCE(SUM(ins.spend), 0)          as total_spend,
                COALESCE(SUM(ins.purchase_value), 0) as total_revenue,
                COALESCE(SUM(ins.impressions), 0)    as total_impressions,
                COALESCE(SUM(ins.clicks), 0)         as total_clicks,
                COALESCE(SUM(ins.unique_clicks), 0)  as total_unique_clicks,
                COALESCE(SUM(ins.reach), 0)          as total_reach,
                COALESCE(SUM(ins.purchases), 0)      as total_purchases,
                COALESCE(SUM(ins.leads), 0)          as total_leads,
                COALESCE(SUM(ins.messages), 0)       as total_messages,
                COALESCE(SUM(ins.engagement), 0)     as total_engagement
            ')
            ->where('ins.level', $level)
            ->whereBetween('ins.date_start', [$start, $end])
            ->when($filter->connectionId, fn ($q) => $q->where('ins.marketing_connection_id', $filter->connectionId))
            ->when($filter->campaignId, fn ($q) => $q->where('ins.marketing_campaign_id', $filter->campaignId))
            ->when($filter->adSetId, fn ($q) => $q->where('ins.marketing_campaign_ad_set_id', $filter->adSetId))
            ->when($filter->companyId, fn ($q) => $q->where('c.company_id', $filter->companyId))
            ->when($filter->status, fn ($q) => $q->where(DB::raw('c.status::text'), $filter->status))
            ->when($filter->adAccountId, fn ($q) => $q->where('c.external_account_id', $filter->adAccountId));

        $row = $query->first();

        $spend = (float) ($row->total_spend ?? 0);
        $revenue = (float) ($row->total_revenue ?? 0);
        $imp = (int) ($row->total_impressions ?? 0);
        $clicks = (int) ($row->total_clicks ?? 0);
        $purchases = (int) ($row->total_purchases ?? 0);

        return [
            'spend' => $spend,
            'revenue' => $revenue,
            'roas' => $spend > 0 ? round($revenue / $spend, 4) : null,
            'cpa' => $purchases > 0 ? round($spend / $purchases, 4) : null,
            'ctr' => $imp > 0 ? round($clicks / $imp, 6) : null,
            'cpc' => $clicks > 0 ? round($spend / $clicks, 4) : null,
            'cpm' => $imp > 0 ? round($spend / $imp * 1000, 4) : null,
            'purchases' => $purchases,
            'leads' => (int) ($row->total_leads ?? 0),
            'impressions' => $imp,
            'clicks' => $clicks,
            'reach' => (int) ($row->total_reach ?? 0),
            'messages' => (int) ($row->total_messages ?? 0),
            'unique_clicks' => (int) ($row->total_unique_clicks ?? 0),
            'engagement' => (int) ($row->total_engagement ?? 0),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function queryRankedEntities(
        IntelligenceFilterDto $filter,
        string $level,
        int $limit,
        string $sortMetric,
        string $direction,
    ): array {
        [$start, $end] = $filter->resolvedDates();

        $entityIdCol = match ($level) {
            'adset' => 'ins.marketing_campaign_ad_set_id',
            'ad' => 'ins.marketing_campaign_ad_id',
            default => 'ins.marketing_campaign_id',
        };

        // Campaign level reuses the existing `c` join — no extra join needed.
        // Adset/ad levels need their own join to fetch the entity name.
        $nameJoin = match ($level) {
            'adset' => 'LEFT JOIN marketing_campaign_ad_sets as ent ON ent.id = ins.marketing_campaign_ad_set_id',
            'ad' => 'LEFT JOIN marketing_campaign_ads as ent ON ent.id = ins.marketing_campaign_ad_id',
            default => null,
        };
        $nameExpr = $nameJoin !== null ? 'ent.name' : 'c.name';

        $query = DB::table('marketing_campaign_insights as ins')
            ->join('marketing_campaigns as c', 'c.id', '=', 'ins.marketing_campaign_id');

        if ($nameJoin !== null) {
            $query->joinRaw($nameJoin);
        }

        $rows = $query
            ->selectRaw("
                {$entityIdCol} as entity_id,
                ins.marketing_campaign_id,
                {$nameExpr}         as entity_name,
                SUM(ins.spend)          as total_spend,
                SUM(ins.purchase_value) as total_revenue,
                SUM(ins.impressions)    as total_impressions,
                SUM(ins.clicks)         as total_clicks,
                SUM(ins.purchases)      as total_purchases,
                SUM(ins.leads)          as total_leads
            ")
            ->where('ins.level', $level)
            ->whereBetween('ins.date_start', [$start, $end])
            ->when($filter->connectionId, fn ($q) => $q->where('ins.marketing_connection_id', $filter->connectionId))
            ->when($filter->campaignId, fn ($q) => $q->where('ins.marketing_campaign_id', $filter->campaignId))
            ->when($filter->companyId, fn ($q) => $q->where('c.company_id', $filter->companyId))
            ->groupByRaw("{$entityIdCol}, ins.marketing_campaign_id, {$nameExpr}")
            ->having('total_spend', '>', 0)
            ->get();

        return $rows->map(function ($row) use ($sortMetric) {
            $spend = (float) ($row->total_spend ?? 0);
            $revenue = (float) ($row->total_revenue ?? 0);
            $imp = (int) ($row->total_impressions ?? 0);
            $clicks = (int) ($row->total_clicks ?? 0);
            $purchases = (int) ($row->total_purchases ?? 0);

            return [
                'entity_id' => $row->entity_id,
                'name' => $row->entity_name,
                'campaign_id' => $row->marketing_campaign_id,
                'spend' => $spend,
                'revenue' => $revenue,
                'roas' => $spend > 0 ? round($revenue / $spend, 4) : null,
                'cpa' => $purchases > 0 ? round($spend / $purchases, 4) : null,
                'ctr' => $imp > 0 ? round($clicks / $imp, 6) : null,
                'purchases' => $purchases,
                'leads' => (int) ($row->total_leads ?? 0),
                'impressions' => $imp,
                'clicks' => $clicks,
                '_sort_key' => match ($sortMetric) {
                    'roas' => $spend > 0 ? $revenue / $spend : null,
                    'ctr' => $imp > 0 ? $clicks / $imp : null,
                    'purchases' => $purchases,
                    'leads' => (int) ($row->total_leads ?? 0),
                    default => $spend,
                },
            ];
        })
            ->sortBy('_sort_key', descending: $direction === 'desc')
            ->values()
            ->take($limit)
            ->map(function ($item) {
                unset($item['_sort_key']);

                return $item;
            })
            ->all();
    }

    private function growthPct(float $current, float $previous): ?float
    {
        if ($previous === 0) {
            return $current > 0 ? 100.0 : null;
        }

        return round(($current - $previous) / $previous * 100, 2);
    }
}
