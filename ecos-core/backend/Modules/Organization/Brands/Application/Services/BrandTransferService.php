<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Application\Services;

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Modules\Admin\Configuration\Domain\Models\ConfigAuditEntry;
use Modules\Organization\Brands\Domain\Contracts\BrandRepositoryInterface;
use Modules\Organization\Brands\Domain\Models\Brand;
use RuntimeException;
use Throwable;

/**
 * Enterprise Brand Transfer Service
 *
 * Moves a Brand from one Company to another in a single atomic transaction.
 *
 * Ownership rules:
 *   - Brand Code is a permanent business identifier — NEVER auto-renamed.
 *     A code conflict is a hard block: fix the conflict and retry.
 *   - Brand Slug is a URL-friendly name — auto-resolved via suffix if needed.
 *   - Every record whose company_id was derived from brand.company_id is
 *     re-stamped to the target company inside the same transaction.
 *
 * Cascade scope (16 tables + the brand itself):
 *   Direct brand_id FKs with denormalized company_id:
 *     channels, config_brand_policies, config_brand_shipping_rules,
 *     business_accounts,
 *     marketing_campaign_business_contexts, marketing_campaign_drafts,
 *     marketing_initiatives, automation_workflows,
 *     bae_business_dna, bae_business_events,
 *     order_financial_snapshots,
 *     cep_conversations, cep_leads, cep_channel_providers
 *
 *   Secondary cascade (company_id stamped from parent):
 *     orders (via channels), order_business_context_snapshots (via orders)
 *
 *   No update required (brand_id FK, no company_id column):
 *     config_delivery_zones, config_delivery_geographies,
 *     config_delivery_windows,
 *     brand_shipping_settings, brand_governorate_settings,
 *     brand_city_settings, products, config_audit_log,
 *     preparation_waves.brand_id
 */
final class BrandTransferService
{
    public function __construct(
        private readonly BrandRepositoryInterface $brands,
    ) {}

    /**
     * Transfer a brand to a different company.
     *
     * @return array{
     *   slug: string,
     *   slug_changed: bool,
     *   cascade: array<string, int>,
     * }
     *
     * @throws RuntimeException when already in target company, or code conflicts.
     */
    public function execute(
        Brand $brand,
        string $targetCompanyId,
        string $actorId,
        ?BrandTransferImpactReport $impactReport = null,
    ): array {
        if ($brand->company_id === $targetCompanyId) {
            throw new RuntimeException('Brand already belongs to this company.');
        }

        // ── Pre-transfer validation ──────────────────────────────────────────

        $this->guardCodeConflict($brand, $targetCompanyId);

        $slug = $this->resolveSlug($brand, $targetCompanyId);

        // ── Atomic transfer ──────────────────────────────────────────────────

        $result = DB::transaction(function () use ($brand, $targetCompanyId, $slug, $actorId): array {
            $brandId = (string) $brand->id;
            $oldCompanyId = (string) $brand->company_id;

            // 1 — Brands table itself
            $brand->update([
                'company_id' => $targetCompanyId,
                'slug' => $slug,
            ]);

            // 2 — Config OS: brand policies (has denormalized company_id + audit fields)
            $policiesUpdated = DB::table('config_brand_policies')
                ->where('brand_id', $brandId)
                ->update([
                    'company_id' => $targetCompanyId,
                    'updated_by' => $actorId,
                    'updated_at' => now(),
                ]);

            // 3 — Config OS: brand shipping rules (has denormalized company_id)
            $shippingRulesUpdated = DB::table('config_brand_shipping_rules')
                ->where('brand_id', $brandId)
                ->update([
                    'company_id' => $targetCompanyId,
                    'updated_by' => $actorId,
                    'updated_at' => now(),
                ]);

            // 4 — Sales channels (company_id is the primary tenant key here)
            $channelsUpdated = DB::table('channels')
                ->where('brand_id', $brandId)
                ->update(['company_id' => $targetCompanyId, 'updated_at' => now()]);

            // Collect channel IDs for secondary cascades
            $channelIds = DB::table('channels')
                ->where('brand_id', $brandId)
                ->pluck('id')
                ->all();

            // 5 — Orders (scoped by the channels we just moved)
            $ordersUpdated = 0;
            $snapshotsUpdated = 0;
            $contextSnapshotsUpdated = 0;

            if ($channelIds !== []) {
                $ordersUpdated = DB::table('orders')
                    ->whereIn('channel_id', $channelIds)
                    ->update(['company_id' => $targetCompanyId]);

                // Collect order IDs for snapshot cascades
                $orderIds = DB::table('orders')
                    ->whereIn('channel_id', $channelIds)
                    ->pluck('id')
                    ->all();

                if ($orderIds !== []) {
                    // 6 — Order business context snapshots
                    $contextSnapshotsUpdated = DB::table('order_business_context_snapshots')
                        ->whereIn('order_id', $orderIds)
                        ->update(['company_id' => $targetCompanyId]);
                }
            }

            // 7 — Order financial snapshots (brand_id is stamped directly)
            $snapshotsUpdated = DB::table('order_financial_snapshots')
                ->where('brand_id', $brandId)
                ->update(['company_id' => $targetCompanyId]);

            // 8 — Organization: Business Accounts
            $businessAccountsUpdated = DB::table('business_accounts')
                ->where('brand_id', $brandId)
                ->update(['company_id' => $targetCompanyId, 'updated_at' => now()]);

            // 9 — Marketing: Campaign Business Contexts
            $campaignContextsUpdated = DB::table('marketing_campaign_business_contexts')
                ->where('brand_id', $brandId)
                ->update(['company_id' => $targetCompanyId]);

            // 10 — Marketing: Campaign Drafts (Campaign Studio)
            $campaignDraftsUpdated = DB::table('marketing_campaign_drafts')
                ->where('brand_id', $brandId)
                ->update(['company_id' => $targetCompanyId]);

            // 11 — Marketing: Initiatives
            $initiativesUpdated = DB::table('marketing_initiatives')
                ->where('brand_id', $brandId)
                ->update(['company_id' => $targetCompanyId]);

            // 12 — Marketing: Automation Workflows
            $workflowsUpdated = DB::table('automation_workflows')
                ->where('brand_id', $brandId)
                ->update(['company_id' => $targetCompanyId]);

            // 13 — BAE: Business DNA
            $businessDnaUpdated = DB::table('bae_business_dna')
                ->where('brand_id', $brandId)
                ->update(['company_id' => $targetCompanyId]);

            // 14 — BAE: Business Events
            $businessEventsUpdated = DB::table('bae_business_events')
                ->where('brand_id', $brandId)
                ->update(['company_id' => $targetCompanyId]);

            // 15 — CEP: Conversations
            $conversationsUpdated = DB::table('cep_conversations')
                ->where('brand_id', $brandId)
                ->update(['company_id' => $targetCompanyId]);

            // 16 — CEP: Leads
            $leadsUpdated = DB::table('cep_leads')
                ->where('brand_id', $brandId)
                ->update(['company_id' => $targetCompanyId]);

            // 17 — CEP: Channel Providers
            $channelProvidersUpdated = DB::table('cep_channel_providers')
                ->where('brand_id', $brandId)
                ->update(['company_id' => $targetCompanyId]);

            return [
                'slug' => $slug,
                'slug_changed' => $slug !== $brand->getOriginal('slug'),
                'from_company' => $oldCompanyId,
                'to_company' => $targetCompanyId,
                'cascade' => [
                    'config_brand_policies' => $policiesUpdated,
                    'config_brand_shipping_rules' => $shippingRulesUpdated,
                    'channels' => $channelsUpdated,
                    'orders' => $ordersUpdated,
                    'order_business_context_snapshots' => $contextSnapshotsUpdated,
                    'order_financial_snapshots' => $snapshotsUpdated,
                    'business_accounts' => $businessAccountsUpdated,
                    'marketing_campaign_business_contexts' => $campaignContextsUpdated,
                    'marketing_campaign_drafts' => $campaignDraftsUpdated,
                    'marketing_initiatives' => $initiativesUpdated,
                    'automation_workflows' => $workflowsUpdated,
                    'bae_business_dna' => $businessDnaUpdated,
                    'bae_business_events' => $businessEventsUpdated,
                    'cep_conversations' => $conversationsUpdated,
                    'cep_leads' => $leadsUpdated,
                    'cep_channel_providers' => $channelProvidersUpdated,
                ],
            ];
        });

        // Audit log — written outside the transfer transaction so a logging
        // failure does not roll back a completed transfer.
        try {
            $actorName = optional(Auth::user())->name ?? $actorId;
            ConfigAuditEntry::create([
                'company_id' => $result['from_company'],
                'brand_id' => (string) $brand->id,
                'module' => 'organization',
                'category' => 'brand_transfer',
                'config_key' => null,
                'old_value' => ['company_id' => $result['from_company']],
                'new_value' => [
                    'company_id' => $result['to_company'],
                    'slug' => $result['slug'],
                    'slug_changed' => $result['slug_changed'],
                    'cascade' => $result['cascade'],
                    'impact_report' => $impactReport?->toArray(),
                ],
                'action' => 'transfer',
                'actor_id' => $actorId ?: null,
                'actor_name' => $actorName,
                'reason' => null,
                'occurred_at' => now(),
            ]);
        } catch (Throwable) {
            // Audit failure must never surface to the caller — the transfer has already
            // committed and the record cannot be rolled back.
        }

        return $result;
    }

    /**
     * Hard block: a Brand Code collision in the target company prevents the transfer.
     * Codes are permanent business identifiers used in accounting and ERP integrations.
     */
    private function guardCodeConflict(Brand $brand, string $targetCompanyId): void
    {
        $conflict = Brand::query()
            ->where('company_id', $targetCompanyId)
            ->where('code', $brand->code)
            ->where('id', '!=', $brand->id)
            ->exists();

        if ($conflict) {
            throw new RuntimeException(
                "Transfer blocked: brand code \"{$brand->code}\" already exists in the target company. ".
                'Codes are permanent business identifiers and cannot be auto-renamed. '.
                "Rename this brand's code before retrying the transfer.",
            );
        }
    }

    /**
     * Slug is URL-friendly — auto-resolve conflicts by appending a numeric suffix.
     * This is safe because slugs are not used in accounting or external integrations.
     */
    private function resolveSlug(Brand $brand, string $targetCompanyId): string
    {
        $slug = $brand->slug;
        $baseSlug = $slug;
        $counter = 2;

        while ($this->brands->existsBySlug($targetCompanyId, $slug)) {
            $slug = $baseSlug.'-'.$counter++;
        }

        return $slug;
    }
}
