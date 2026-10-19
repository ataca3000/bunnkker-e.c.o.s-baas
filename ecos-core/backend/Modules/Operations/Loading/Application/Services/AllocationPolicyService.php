<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Application\Services;

use App\Core\FeatureFlags\FeatureFlagService;
use Illuminate\Support\Facades\DB;
use Modules\Operations\Loading\Domain\Enums\AllocationMode;

/**
 * Policy decisions for the automatic allocation engine.
 *
 * CONTRACT: read-only — no DB writes, no events.
 * All methods default to the most permissive/operational value so the
 * system works out-of-the-box and operators opt-in to restrictions.
 */
final class AllocationPolicyService
{
    public function __construct(private readonly FeatureFlagService $flags) {}

    /**
     * Whether the engine may create an AllocationRecord for a partial quantity
     * (i.e. vehicle carries less than the order line requests).
     *
     * Default: ALLOWED. Disable by enabling flag 'loading.strict_allocation'.
     */
    public function allowsPartialAllocation(?string $companyId = null): bool
    {
        return ! $this->flags->isEnabled('loading.strict_allocation', $companyId);
    }

    /**
     * Maximum shortage fraction that is still acceptable for a partial record.
     * E.g. 0.2 = up to 20% short is OK; beyond that the line is skipped.
     * Default: 1.0 (any shortage is tolerable if partials are allowed).
     */
    public function maxPartialTolerancePct(?string $companyId = null): float
    {
        $cfg = $this->getActiveConfig($companyId);

        return (float) ($cfg['loading']['allocation']['max_partial_pct'] ?? 1.0);
    }

    /**
     * Whether each vehicle is restricted to only the orders assigned to its
     * VehiclePlanSlot. When false (default) every vehicle can absorb any wave
     * order that matches a product it carries.
     */
    public function useVehiclePlanSlots(?string $companyId = null): bool
    {
        return $this->flags->isEnabled('loading.use_vehicle_plan_slots', $companyId);
    }

    /**
     * Whether orders should be allocated in ascending preparation_priority order
     * so that high-priority orders claim capacity before lower-priority ones.
     * Default: ENABLED.
     */
    public function priorityAllocationEnabled(?string $companyId = null): bool
    {
        return ! $this->flags->isEnabled('loading.disable_priority_allocation', $companyId);
    }

    /**
     * The AllocationMode written to each new AllocationRecord when the full
     * quantity is satisfied.
     */
    public function defaultMode(?string $companyId = null): AllocationMode
    {
        $cfg = $this->getActiveConfig($companyId);
        $raw = $cfg['loading']['allocation']['default_mode'] ?? null;

        return $raw !== null
            ? (AllocationMode::tryFrom((string) $raw) ?? AllocationMode::FullAuto)
            : AllocationMode::FullAuto;
    }

    /** @return array<string, mixed> */
    private function getActiveConfig(?string $companyId): array
    {
        if ($companyId === null) {
            return [];
        }
        $raw = DB::table('configuration_versions')
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->value('configuration');

        return $raw !== null ? (array) json_decode((string) $raw, true) : [];
    }
}
