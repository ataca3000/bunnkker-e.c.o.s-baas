<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Application\Services;

use Illuminate\Support\Facades\DB;
use Modules\Marketing\Campaigns\Domain\Models\Campaign;

/**
 * Campaign Ranking Engine (Phase 7).
 *
 * Ranks campaigns, ad sets, and ads by performance metrics.
 * Reads from the latest CampaignInsight snapshots.
 *
 * Views: Top Campaigns, Top Ad Sets, Top Ads, Top Creatives,
 *        Top Companies, Top Brands, Top Channels, Top Marketing Owners
 */
final class CampaignRankingService
{
    /**
     * @param  string  $metric  spend|ctr|cpc|cpm|purchases|leads|messages|reach
     * @param  string  $level  campaign|adset|ad
     * @param  string|null  $datePreset  last_7d|last_30d|last_90d
     * @return list<array<string, mixed>>
     */
    public function top(
        string $metric = 'spend',
        string $level = 'campaign',
        int $limit = 10,
        ?string $companyId = null,
        ?string $datePreset = 'last_30d',
    ): array {
        $allowedMetrics = ['spend', 'ctr', 'cpc', 'cpm', 'purchases', 'leads', 'messages', 'reach', 'impressions', 'clicks'];
        $metric = in_array($metric, $allowedMetrics, true) ? $metric : 'spend';

        // For ordering: spend/purchases/leads/messages/reach DESC, cpc ASC (lower is better)
        $order = in_array($metric, ['cpc', 'cpm', 'cost_per_result'], true) ? 'ASC' : 'DESC';

        $dateRange = $this->dateRangeFromPreset($datePreset ?? 'last_30d');

        // Aggregate latest insights per entity
        $results = DB::table('marketing_campaign_insights as ins')
            ->selectRaw('
                ins.marketing_campaign_id,
                ins.marketing_campaign_ad_set_id,
                ins.marketing_campaign_ad_id,
                ins.level,
                SUM(ins.spend)       as total_spend,
                AVG(ins.ctr)         as avg_ctr,
                AVG(ins.cpc)         as avg_cpc,
                AVG(ins.cpm)         as avg_cpm,
                SUM(ins.purchases)   as total_purchases,
                SUM(ins.leads)       as total_leads,
                SUM(ins.messages)    as total_messages,
                SUM(ins.reach)       as total_reach,
                SUM(ins.impressions) as total_impressions,
                SUM(ins.clicks)      as total_clicks
            ')
            ->where('ins.level', $level)
            ->whereBetween('ins.date_start', [$dateRange['start'], $dateRange['end']])
            ->when($companyId, fn ($q) => $q->where(function ($q2) use ($companyId) {
                $q2->whereExists(function ($sub) use ($companyId) {
                    $sub->select(DB::raw(1))
                        ->from('marketing_campaigns')
                        ->whereColumn('marketing_campaigns.id', 'ins.marketing_campaign_id')
                        ->where('marketing_campaigns.company_id', $companyId);
                });
            }))
            ->groupBy('ins.marketing_campaign_id', 'ins.marketing_campaign_ad_set_id', 'ins.marketing_campaign_ad_id', 'ins.level')
            ->orderByRaw("total_{$metric} IS NULL ASC")
            ->when($order === 'DESC', fn ($q) => $q->orderByDesc("total_{$metric}"))
            ->when($order === 'ASC', fn ($q) => $q->orderBy("total_{$metric}"))
            ->limit($limit)
            ->get();

        return $results->map(function ($row) use ($level) {
            $entityId = match ($level) {
                'adset' => $row->marketing_campaign_ad_set_id,
                'ad' => $row->marketing_campaign_ad_id,
                default => $row->marketing_campaign_id,
            };

            return [
                'entity_id' => $entityId,
                'campaign_id' => $row->marketing_campaign_id,
                'level' => $level,
                'total_spend' => $row->total_spend,
                'avg_ctr' => $row->avg_ctr,
                'avg_cpc' => $row->avg_cpc,
                'avg_cpm' => $row->avg_cpm,
                'total_purchases' => $row->total_purchases,
                'total_leads' => $row->total_leads,
                'total_messages' => $row->total_messages,
                'total_reach' => $row->total_reach,
                'total_impressions' => $row->total_impressions,
                'total_clicks' => $row->total_clicks,
            ];
        })->toArray();
    }

    /**
     * Rank by business context dimension (company, brand, channel, marketing_owner).
     *
     * @param  string  $dimension  company_id|brand_id|channel_id|marketing_owner_id
     * @return list<array<string, mixed>>
     */
    public function topByDimension(string $dimension, string $metric = 'spend', int $limit = 10): array
    {
        $allowedDimensions = ['company_id', 'brand_id', 'channel_id', 'marketing_owner_id'];
        if (! in_array($dimension, $allowedDimensions, true)) {
            return [];
        }

        $allowedMetrics = ['spend', 'purchases', 'leads', 'messages', 'reach'];
        $metric = in_array($metric, $allowedMetrics, true) ? $metric : 'spend';

        return DB::table('marketing_campaign_insights as ins')
            ->join('marketing_campaign_business_contexts as ctx', 'ctx.marketing_campaign_id', '=', 'ins.marketing_campaign_id')
            ->selectRaw("
                ctx.{$dimension} as dimension_id,
                SUM(ins.{$metric}) as total,
                COUNT(DISTINCT ins.marketing_campaign_id) as campaign_count
            ")
            ->where('ins.level', 'campaign')
            ->whereNotNull("ctx.{$dimension}")
            ->groupBy("ctx.{$dimension}")
            ->orderByDesc('total')
            ->limit($limit)
            ->get()
            ->toArray();
    }

    /** @return array{start: string, end: string} */
    private function dateRangeFromPreset(string $preset): array
    {
        return match ($preset) {
            'last_7d' => ['start' => now()->subDays(7)->toDateString(),  'end' => now()->toDateString()],
            'last_90d' => ['start' => now()->subDays(90)->toDateString(), 'end' => now()->toDateString()],
            'last_180d' => ['start' => now()->subDays(180)->toDateString(), 'end' => now()->toDateString()],
            'this_month' => ['start' => now()->startOfMonth()->toDateString(), 'end' => now()->toDateString()],
            default => ['start' => now()->subDays(30)->toDateString(), 'end' => now()->toDateString()],
        };
    }
}
