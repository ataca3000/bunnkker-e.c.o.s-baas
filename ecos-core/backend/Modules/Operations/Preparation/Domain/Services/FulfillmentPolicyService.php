<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Services;

use App\Core\FeatureFlags\FeatureFlagService;
use Illuminate\Support\Facades\DB;

/**
 * Fulfillment Policy — reads configuration from feature_flags + preparation_policies table.
 *
 * CONTRACT: must NOT update any records, dispatch events, or call application services.
 * Returns typed booleans / values for every policy decision.
 */
final class FulfillmentPolicyService
{
    public function __construct(private readonly FeatureFlagService $flags) {}

    /** Whether a supervisor must approve a wave before it can be started. */
    public function requiresWaveApproval(?string $companyId = null): bool
    {
        return $this->flags->isEnabled('preparation.wave_approval', $companyId);
    }

    /** Whether prepared pool entries must pass a quality check before loading. */
    public function requiresPoolQualityCheck(?string $companyId = null): bool
    {
        return $this->flags->isEnabled('preparation.quality_check', $companyId);
    }

    /** Whether MRP should run automatically after demand generation. */
    public function autoRunMrp(?string $companyId = null): bool
    {
        return $this->flags->isEnabled('preparation.auto_mrp', $companyId);
    }

    /** Whether PRP should run automatically after demand generation. */
    public function autoRunPrp(?string $companyId = null): bool
    {
        return $this->flags->isEnabled('preparation.auto_prp', $companyId);
    }

    /**
     * Maximum number of orders allowed per wave.
     * Reads from configuration_versions table if present, falls back to 500.
     */
    public function maxWaveSize(?string $companyId = null): int
    {
        $config = DB::table('configuration_versions')
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->value('configuration');

        if ($config !== null) {
            $decoded = json_decode($config, true);
            $max = $decoded['preparation']['wave']['max_size'] ?? null;
            if ($max !== null) {
                return (int) $max;
            }
        }

        return 500;
    }

    /**
     * Allowed overprepare tolerance (e.g. 0.05 = 5% over required quantity is allowed).
     * Returns 0.0 if overprepare is not allowed.
     */
    public function overprepareTolerance(?string $companyId = null): float
    {
        $config = DB::table('configuration_versions')
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->value('configuration');

        if ($config !== null) {
            $decoded = json_decode($config, true);
            $tolerance = $decoded['preparation']['wave']['overprepare_tolerance'] ?? null;
            if ($tolerance !== null) {
                return (float) $tolerance;
            }
        }

        return 0.0;
    }
}
