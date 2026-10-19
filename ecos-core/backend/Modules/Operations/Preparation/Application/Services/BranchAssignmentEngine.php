<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Services;

use Illuminate\Support\Collection;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Organization\Branches\Domain\Models\Branch;
use Modules\Organization\Branches\Domain\Models\BranchCoverageArea;
use Modules\Operations\Preparation\Domain\Enums\WarehouseAssignmentSource;
use Modules\Operations\Preparation\Domain\Events\BranchAssigned;

/**
 * TASK-BRANCH-ASSIGNMENT-ENGINE-001 — Branch Assignment Engine.
 *
 * Replaces WarehouseAssignmentEngine with an intelligent coverage-driven assignment.
 *
 * Flow:
 *   Order → customer delivery governorate + zone
 *   → CoverageResolutionService → candidate BranchCoverageArea list
 *   → select best branch (single: direct; multiple: nearest by Haversine / priority)
 *   → BranchWarehouseResolver → warehouse for that branch
 *   → persist: assigned_branch_id + assigned_warehouse_id + warehouse_assignment_source
 *   → dispatch BranchAssigned event
 *
 * When no branch covers the destination:
 *   → warehouse_assignment_source = no_branch_coverage
 *   → warehouse_assignment_failure_reason = 'No Branch Covers Destination'
 *   → assigned_branch_id + assigned_warehouse_id stay NULL
 *   → order status is NOT changed (remains Operations problem, not Inventory problem)
 */
final class BranchAssignmentEngine
{
    public function __construct(
        private readonly CoverageResolutionService $coverage,
        private readonly BranchWarehouseResolver $warehouseResolver,
    ) {}

    /**
     * Assign a branch (and its warehouse) to the order using coverage rules.
     *
     * Caller: CreateManualOrderAction (and any other order ingestion path).
     *
     * @param  string|null $companyId  Resolved company context; falls back to order.company_id.
     */
    public function assign(Order $order, ?string $companyId = null): void
    {
        $companyId ??= $order->company_id;

        if ($companyId === null) {
            $this->markUnresolved($order);

            return;
        }

        $governorate = (string) ($order->governorate ?? '');
        $zone        = (string) ($order->area ?? $order->delivery_zone ?? '');

        if ($governorate === '') {
            $this->markUnresolved($order);

            return;
        }

        $candidates = $this->coverage->resolve($governorate, $zone ?: null);

        // Filter to branches that belong to this company and are active.
        $candidates = $candidates->filter(
            fn (BranchCoverageArea $c) => $c->branch !== null
                && $c->branch->company_id === $companyId
                && $c->branch->is_active,
        );

        if ($candidates->isEmpty()) {
            $this->markNoCoverage($order);

            return;
        }

        $branch = $candidates->count() === 1
            ? $candidates->first()->branch
            : $this->selectNearest($order, $candidates);

        $warehouseId = $this->warehouseResolver->resolve($branch);

        if ($warehouseId === null) {
            $this->markNoCoverage($order, 'Assigned branch has no active warehouse');

            return;
        }

        $previousBranchId    = $order->assigned_branch_id;
        $previousWarehouseId = $order->assigned_warehouse_id;

        $order->update([
            'assigned_branch_id'        => $branch->id,
            'assigned_warehouse_id'     => $warehouseId,
            'warehouse_assigned_at'     => now(),
            'warehouse_assignment_source' => WarehouseAssignmentSource::BranchCoverage->value,
            'warehouse_assignment_failure_reason' => null,
        ]);

        BranchAssigned::dispatch(
            orderId: $order->id,
            branchId: $branch->id,
            warehouseId: $warehouseId,
            previousBranchId: $previousBranchId,
            previousWarehouseId: $previousWarehouseId,
            occurredAt: now()->toIso8601String(),
        );
    }

    /**
     * Supervisor manually assigns a specific branch (and its warehouse) to an order.
     * Stores an audit trail via warehouse_assignment_source = manual_override.
     */
    public function override(Order $order, Branch $branch, string $reason): void
    {
        $warehouseId = $this->warehouseResolver->resolve($branch);

        if ($warehouseId === null) {
            $this->markNoCoverage($order, 'Overridden branch has no active warehouse');

            return;
        }

        $previousBranchId    = $order->assigned_branch_id;
        $previousWarehouseId = $order->assigned_warehouse_id;

        $order->update([
            'assigned_branch_id'        => $branch->id,
            'assigned_warehouse_id'     => $warehouseId,
            'warehouse_assigned_at'     => now(),
            'warehouse_assignment_source' => WarehouseAssignmentSource::ManualOverride->value,
            'warehouse_assignment_failure_reason' => null,
        ]);

        BranchAssigned::dispatch(
            orderId: $order->id,
            branchId: $branch->id,
            warehouseId: $warehouseId,
            previousBranchId: $previousBranchId,
            previousWarehouseId: $previousWarehouseId,
            occurredAt: now()->toIso8601String(),
        );
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    /**
     * Select the nearest branch to the order's delivery coordinates.
     * Falls back to priority ordering when GPS coordinates are unavailable on
     * either the order or the branch.
     *
     * @param  Collection<int, BranchCoverageArea> $candidates  Already priority-sorted ASC.
     */
    private function selectNearest(Order $order, Collection $candidates): Branch
    {
        $orderLat = $order->google_maps_lat !== null ? (float) $order->google_maps_lat : null;
        $orderLng = $order->google_maps_lng !== null ? (float) $order->google_maps_lng : null;

        if ($orderLat !== null && $orderLng !== null) {
            $best     = null;
            $bestDist = PHP_FLOAT_MAX;

            foreach ($candidates as $candidate) {
                $branch = $candidate->branch;
                if ($branch === null) {
                    continue;
                }

                $bLat = $branch->latitude !== null ? (float) $branch->latitude : null;
                $bLng = $branch->longitude !== null ? (float) $branch->longitude : null;

                if ($bLat === null || $bLng === null) {
                    continue;
                }

                $dist = $this->haversineKm($orderLat, $orderLng, $bLat, $bLng);
                if ($dist < $bestDist) {
                    $bestDist = $dist;
                    $best     = $branch;
                }
            }

            if ($best !== null) {
                return $best;
            }
        }

        // No GPS available on order or branches — fall back to priority ordering (candidates are
        // already sorted ASC by priority coming from CoverageResolutionService).
        return $candidates->first()->branch;
    }

    /**
     * Great-circle distance between two points (Haversine formula), in kilometres.
     */
    private function haversineKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371.0;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return $earthRadius * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    /** No governorate/zone on the order — cannot resolve coverage. */
    private function markUnresolved(Order $order): void
    {
        $order->update([
            'warehouse_assigned_at'     => now(),
            'warehouse_assignment_source' => WarehouseAssignmentSource::Unassigned->value,
        ]);
    }

    /**
     * Coverage resolution returned no matching branch.
     * This is an Operations triage signal — NOT an Inventory problem.
     * order.status is intentionally left unchanged.
     */
    private function markNoCoverage(Order $order, string $reason = 'No Branch Covers Destination'): void
    {
        $order->update([
            'warehouse_assigned_at'               => now(),
            'warehouse_assignment_source'          => WarehouseAssignmentSource::NoBranchCoverage->value,
            'warehouse_assignment_failure_reason'  => $reason,
        ]);
    }
}
