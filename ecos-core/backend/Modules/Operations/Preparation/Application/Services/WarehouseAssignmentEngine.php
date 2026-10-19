<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Services;

use Illuminate\Support\Facades\DB;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Operations\Preparation\Domain\Enums\WarehouseAssignmentSource;
use Modules\Operations\Preparation\Domain\Events\WarehouseAssigned;
use Modules\Operations\Preparation\Domain\Models\WarehouseAssignmentOverride;
use Modules\Operations\Preparation\Domain\Models\WarehouseAssignmentPolicy;

/**
 * CR-PREP-001 — Warehouse Assignment Engine.
 *
 * The ONLY permitted location for warehouse assignment logic.
 * Called during order import and whenever an order's channel/location changes.
 *
 * Matching algorithm (first match wins, ordered by specificity DESC, priority ASC):
 *   1. channel_id = order.channel_id AND governorate = order.governorate
 *   2. channel_id = order.channel_id AND governorate IS NULL
 *   3. channel_id IS NULL          AND governorate = order.governorate
 *   4. channel_id IS NULL          AND governorate IS NULL  (company fallback)
 */
final class WarehouseAssignmentEngine
{
    /**
     * Assign a warehouse to an order based on active policies.
     * Updates the order in place and dispatches WarehouseAssigned.
     */
    public function assign(Order $order, ?string $companyId = null): void
    {
        $companyId ??= $order->company_id ?? $order->channel?->brand?->company_id;

        if ($companyId === null) {
            $this->markUnassigned($order);

            return;
        }

        $policy = $this->findMatchingPolicy($companyId, $order->channel_id, $order->governorate);

        if ($policy === null) {
            $this->markUnassigned($order);

            return;
        }

        $previousWarehouseId = $order->assigned_warehouse_id;

        $order->update([
            'assigned_warehouse_id' => $policy->warehouse_id,
            'warehouse_assigned_at' => now(),
            'warehouse_assignment_source' => WarehouseAssignmentSource::AutoPolicy->value,
        ]);

        WarehouseAssigned::dispatch(
            orderId: $order->id,
            warehouseId: $policy->warehouse_id,
            previousWarehouseId: $previousWarehouseId,
            source: WarehouseAssignmentSource::AutoPolicy,
            policyId: $policy->id,
            occurredAt: now()->toIso8601String(),
        );
    }

    /**
     * Supervisor manually overrides the assigned warehouse.
     * Stores a full audit trail in warehouse_assignment_overrides.
     */
    public function override(
        Order $order,
        string $newWarehouseId,
        string $reason,
        string $supervisorId,
    ): void {
        DB::transaction(function () use ($order, $newWarehouseId, $reason, $supervisorId): void {
            $previousWarehouseId = $order->assigned_warehouse_id;

            WarehouseAssignmentOverride::create([
                'order_id' => $order->id,
                'previous_warehouse_id' => $previousWarehouseId,
                'new_warehouse_id' => $newWarehouseId,
                'reason' => $reason,
                'overridden_by' => $supervisorId,
                'overridden_at' => now(),
            ]);

            $order->update([
                'assigned_warehouse_id' => $newWarehouseId,
                'warehouse_assigned_at' => now(),
                'warehouse_assignment_source' => WarehouseAssignmentSource::ManualOverride->value,
            ]);

            WarehouseAssigned::dispatch(
                orderId: $order->id,
                warehouseId: $newWarehouseId,
                previousWarehouseId: $previousWarehouseId,
                source: WarehouseAssignmentSource::ManualOverride,
                policyId: null,
                occurredAt: now()->toIso8601String(),
            );
        });
    }

    /**
     * Find the best-matching policy for a given context.
     * Returns null when no active policy covers the combination.
     */
    public function findMatchingPolicy(
        string $companyId,
        ?string $channelId,
        ?string $governorate,
    ): ?WarehouseAssignmentPolicy {
        $policies = WarehouseAssignmentPolicy::query()
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->orderByRaw('priority ASC')
            ->get();

        // Score each policy — pick the one with the highest specificity that matches.
        $best = null;
        $bestScore = -1;

        foreach ($policies as $policy) {
            if (! $this->matches($policy, $channelId, $governorate)) {
                continue;
            }

            $score = $policy->specificity();
            if ($score > $bestScore) {
                $bestScore = $score;
                $best = $policy;
            }
        }

        return $best;
    }

    private function matches(
        WarehouseAssignmentPolicy $policy,
        ?string $channelId,
        ?string $governorate,
    ): bool {
        // Channel constraint: if policy specifies a channel, order must match.
        if ($policy->channel_id !== null && $policy->channel_id !== $channelId) {
            return false;
        }

        // Governorate constraint: if policy specifies a governorate, order must match.
        if ($policy->governorate !== null) {
            if ($governorate === null) {
                return false;
            }
            if (mb_strtolower($policy->governorate) !== mb_strtolower($governorate)) {
                return false;
            }
        }

        // Zone constraint: if policy specifies a zone, order area must match.
        if ($policy->zone !== null) {
            return false; // Zone matching deferred — zone entity not yet implemented.
        }

        return true;
    }

    private function markUnassigned(Order $order): void
    {
        $order->update([
            'warehouse_assignment_source' => WarehouseAssignmentSource::Unassigned->value,
            'warehouse_assigned_at' => now(),
        ]);
    }
}
