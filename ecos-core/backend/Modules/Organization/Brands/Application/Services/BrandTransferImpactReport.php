<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Application\Services;

/**
 * Value object returned by BrandTransferAnalysisService.
 *
 * Carries every count and conflict detail so the frontend can render
 * a complete impact analysis before the user confirms the transfer.
 */
final readonly class BrandTransferImpactReport
{
    public function __construct(
        // Context
        public readonly string $brandId,
        public readonly string $brandCode,
        public readonly string $brandSlug,
        public readonly string $fromCompanyId,
        public readonly string $toCompanyId,

        // Entity counts (what will be re-stamped)
        public readonly int $channelsCount,
        public readonly int $ordersCount,
        public readonly int $productsCount,
        public readonly int $businessAccountsCount,
        public readonly int $marketingCampaignsCount,
        public readonly int $automationWorkflowsCount,
        public readonly int $aiContextsCount,
        public readonly int $cepConversationsCount,
        public readonly int $policiesCount,
        public readonly int $totalRecordsAffected,

        // Warnings (non-blocking — transfer can proceed)
        public readonly bool $slugConflict,
        public readonly string $resolvedSlug,
        public readonly int $lockedSnapshotsCount,

        // Blockers (transfer cannot proceed until resolved)
        public readonly bool $codeConflict,
    ) {}

    public function hasBlockers(): bool
    {
        return $this->codeConflict;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'brand_id' => $this->brandId,
            'brand_code' => $this->brandCode,
            'brand_slug' => $this->brandSlug,
            'from_company_id' => $this->fromCompanyId,
            'to_company_id' => $this->toCompanyId,
            'counts' => [
                'channels' => $this->channelsCount,
                'orders' => $this->ordersCount,
                'products' => $this->productsCount,
                'business_accounts' => $this->businessAccountsCount,
                'marketing_campaigns' => $this->marketingCampaignsCount,
                'automation_workflows' => $this->automationWorkflowsCount,
                'ai_contexts' => $this->aiContextsCount,
                'cep_conversations' => $this->cepConversationsCount,
                'policies' => $this->policiesCount,
                'total_records' => $this->totalRecordsAffected,
            ],
            'warnings' => [
                'slug_conflict' => $this->slugConflict,
                'resolved_slug' => $this->resolvedSlug,
                'locked_snapshots' => $this->lockedSnapshotsCount,
            ],
            'blockers' => [
                'code_conflict' => $this->codeConflict,
            ],
            'has_blockers' => $this->hasBlockers(),
        ];
    }
}
