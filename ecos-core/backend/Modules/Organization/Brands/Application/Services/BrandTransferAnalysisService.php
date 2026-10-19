<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Application\Services;

use Illuminate\Support\Facades\DB;
use Modules\Organization\Brands\Domain\Contracts\BrandRepositoryInterface;
use Modules\Organization\Brands\Domain\Models\Brand;

/**
 * Read-only pre-flight analysis for brand transfers.
 *
 * Calculates every entity that would be re-stamped, detects hard blockers
 * (code conflicts) and soft warnings (slug rename, locked snapshots) — all
 * without touching a single row of data.
 */
final class BrandTransferAnalysisService
{
    public function __construct(
        private readonly BrandRepositoryInterface $brands,
    ) {}

    public function analyze(Brand $brand, string $targetCompanyId): BrandTransferImpactReport
    {
        $brandId = (string) $brand->id;
        $fromCompany = (string) $brand->company_id;

        // ── Blocker: code conflict ────────────────────────────────────────────

        $codeConflict = Brand::query()
            ->where('company_id', $targetCompanyId)
            ->where('code', $brand->code)
            ->where('id', '!=', $brandId)
            ->exists();

        // ── Warning: slug conflict / auto-resolve ─────────────────────────────

        $slugConflict = $this->brands->existsBySlug($targetCompanyId, $brand->slug);
        $resolvedSlug = $brand->slug;

        if ($slugConflict) {
            $counter = 2;
            $base = $brand->slug;
            do {
                $resolvedSlug = $base.'-'.$counter++;
            } while ($this->brands->existsBySlug($targetCompanyId, $resolvedSlug));
        }

        // ── Entity counts (all read-only) ─────────────────────────────────────

        // Channels directly owned by this brand
        $channelIds = DB::table('channels')
            ->where('brand_id', $brandId)
            ->pluck('id')
            ->all();

        $channelsCount = count($channelIds);

        // Orders flowing through those channels
        $ordersCount = $channelIds !== []
            ? DB::table('orders')->whereIn('channel_id', $channelIds)->count()
            : 0;

        // Products assigned to this brand (brand_id FK, not cascaded but shown for context)
        $productsCount = DB::table('products')
            ->where('brand_id', $brandId)
            ->count();

        // Business accounts
        $businessAccountsCount = DB::table('business_accounts')
            ->where('brand_id', $brandId)
            ->count();

        // Marketing: campaigns (contexts + drafts) + initiatives (all represent campaign work)
        $marketingCampaignsCount =
            DB::table('marketing_campaign_business_contexts')->where('brand_id', $brandId)->count()
            + DB::table('marketing_campaign_drafts')->where('brand_id', $brandId)->count()
            + DB::table('marketing_initiatives')->where('brand_id', $brandId)->count();

        // Automation workflows
        $automationWorkflowsCount = DB::table('automation_workflows')
            ->where('brand_id', $brandId)
            ->count();

        // AI contexts (BAE: DNA + Events)
        $aiContextsCount =
            DB::table('bae_business_dna')->where('brand_id', $brandId)->count()
            + DB::table('bae_business_events')->where('brand_id', $brandId)->count();

        // CEP: conversations + leads + channel providers
        $cepConversationsCount =
            DB::table('cep_conversations')->where('brand_id', $brandId)->count()
            + DB::table('cep_leads')->where('brand_id', $brandId)->count()
            + DB::table('cep_channel_providers')->where('brand_id', $brandId)->count();

        // Config policies
        $policiesCount = DB::table('config_brand_policies')
            ->where('brand_id', $brandId)
            ->count();

        // ── Warning: locked financial snapshots ───────────────────────────────

        $lockedSnapshotsCount = DB::table('order_financial_snapshots')
            ->where('brand_id', $brandId)
            ->where('locked', true)
            ->count();

        // ── Total rows that will be updated ───────────────────────────────────

        $snapshotsCount = DB::table('order_financial_snapshots')
            ->where('brand_id', $brandId)
            ->count();

        $totalRecordsAffected =
            1                          // the brand row itself
            + $policiesCount
            + $channelsCount
            + $ordersCount
            + $snapshotsCount
            + $businessAccountsCount
            + $marketingCampaignsCount
            + $automationWorkflowsCount
            + $aiContextsCount
            + $cepConversationsCount;

        return new BrandTransferImpactReport(
            brandId: $brandId,
            brandCode: $brand->code,
            brandSlug: $brand->slug,
            fromCompanyId: $fromCompany,
            toCompanyId: $targetCompanyId,
            channelsCount: $channelsCount,
            ordersCount: $ordersCount,
            productsCount: $productsCount,
            businessAccountsCount: $businessAccountsCount,
            marketingCampaignsCount: $marketingCampaignsCount,
            automationWorkflowsCount: $automationWorkflowsCount,
            aiContextsCount: $aiContextsCount,
            cepConversationsCount: $cepConversationsCount,
            policiesCount: $policiesCount,
            totalRecordsAffected: $totalRecordsAffected,
            slugConflict: $slugConflict,
            resolvedSlug: $resolvedSlug,
            lockedSnapshotsCount: $lockedSnapshotsCount,
            codeConflict: $codeConflict,
        );
    }
}
