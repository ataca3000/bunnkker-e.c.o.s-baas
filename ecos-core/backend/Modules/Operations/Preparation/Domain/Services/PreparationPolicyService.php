<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Services;

use App\Core\FeatureFlags\FeatureFlagService;
use Modules\Admin\Configuration\Domain\Models\BrandPolicy;

/**
 * Preparation Policy — module-level policy checks.
 *
 * CONTRACT: read-only, no DB writes, no events.
 */
final class PreparationPolicyService
{
    public function __construct(private readonly FeatureFlagService $flags) {}

    /** Whether the Preparation OS module is enabled for a company. */
    public function moduleEnabled(?string $companyId = null): bool
    {
        return $this->flags->isEnabled('modules.preparation_os', $companyId);
    }

    /** Whether the preparation workflow stage is enabled. */
    public function workflowEnabled(?string $companyId = null): bool
    {
        return $this->flags->isEnabled('workflow.preparation', $companyId);
    }

    /** Whether AI features are enabled. */
    public function aiEnabled(?string $companyId = null): bool
    {
        return $this->flags->isEnabled('ai.preparation', $companyId);
    }

    /** Whether analytics are enabled. */
    public function analyticsEnabled(?string $companyId = null): bool
    {
        return $this->flags->isEnabled('preparation.analytics', $companyId);
    }

    /**
     * Fetch the active BrandPolicy 'preparation' settings for a brand.
     * Returns defaults if no policy row exists yet.
     *
     * @return array<string, mixed>
     */
    public function getActivePolicyForBrand(string $brandId): array
    {
        $policy = BrandPolicy::where('brand_id', $brandId)
            ->where('policy_group', 'preparation')
            ->where('is_active', true)
            ->first();

        return $policy?->settings ?? BrandPolicy::defaultSettings('preparation');
    }

    /** Maximum wave size from brand policy (batch_size setting). */
    public function maxWaveSizeForBrand(string $brandId): int
    {
        return (int) ($this->getActivePolicyForBrand($brandId)['batch_size'] ?? 50);
    }

    /** Whether partial preparation is allowed per brand policy. */
    public function allowsPartialPreparationForBrand(string $brandId): bool
    {
        return (bool) ($this->getActivePolicyForBrand($brandId)['partial_preparation'] ?? false);
    }

    /** Negative stock handling strategy: 'block' | 'allow' | 'notify'. */
    public function negativeStockHandlingForBrand(string $brandId): string
    {
        return (string) ($this->getActivePolicyForBrand($brandId)['negative_stock_handling'] ?? 'block');
    }
}
