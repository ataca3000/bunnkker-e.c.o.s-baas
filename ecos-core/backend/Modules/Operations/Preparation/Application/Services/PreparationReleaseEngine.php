<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Services;

use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Operations\Preparation\Domain\Models\PreparationSessionPolicy;

/**
 * CR-PREP-001HF — Preparation Release Engine.
 *
 * The ONLY authority that decides whether an order may enter (or remain in)
 * a Preparation Session. All attachment decisions must pass through here.
 *
 * Policy-driven: eligible_order_statuses drives every check.
 * No hardcoded status checks exist anywhere else in the Preparation module.
 */
final class PreparationReleaseEngine
{
    /**
     * Returns true when the order is allowed to enter or remain in a session.
     */
    public function isEligible(Order $order, ?PreparationSessionPolicy $policy = null): bool
    {
        return $this->ineligibilityReason($order, $policy) === null;
    }

    /**
     * Returns a machine-readable reason why the order cannot enter Preparation,
     * or null when the order IS eligible.
     *
     * Callers should treat this as opaque for business logic and readable for
     * audit / event payloads.
     */
    public function ineligibilityReason(Order $order, ?PreparationSessionPolicy $policy = null): ?string
    {
        $eligibleStatuses = $policy?->eligible_order_statuses
            ?? PreparationSessionPolicy::defaultEligibleStatuses();

        if (! in_array($order->status->value, $eligibleStatuses, true)) {
            return 'status_ineligible:'.$order->status->value;
        }

        if ($order->assigned_warehouse_id === null) {
            return 'no_warehouse_assigned';
        }

        return null;
    }

    /**
     * Resolve the active preparation policy for a warehouse.
     * Warehouse-specific policy takes precedence over a company-wide policy.
     */
    public function resolvePolicy(string $companyId, ?string $warehouseId): ?PreparationSessionPolicy
    {
        return PreparationSessionPolicy::query()
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->where(function ($q) use ($warehouseId): void {
                $q->where('warehouse_id', $warehouseId)
                    ->orWhereNull('warehouse_id');
            })
            ->orderByRaw('CASE WHEN warehouse_id IS NULL THEN 1 ELSE 0 END ASC')
            ->first();
    }
}
