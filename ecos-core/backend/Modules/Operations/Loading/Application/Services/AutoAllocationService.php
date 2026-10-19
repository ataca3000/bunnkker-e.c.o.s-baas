<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Application\Services;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Modules\Commerce\Orders\Domain\Models\OrderLine;
use Modules\Operations\Loading\Domain\Enums\AllocationMode;
use Modules\Operations\Loading\Domain\Enums\AllocationRecordStatus;
use Modules\Operations\Loading\Domain\Models\AllocationRecord;
use Modules\Operations\Loading\Domain\Models\LoadingSession;
use Modules\Operations\Loading\Domain\Models\LoadingTask;
use Modules\Operations\Loading\Domain\Models\VehicleAssignment;
use Modules\Operations\Loading\Domain\Models\VehicleInventoryItem;
use Modules\Operations\Loading\Domain\Models\VehiclePlanSlotOrder;
use Modules\Operations\Loading\Domain\Services\AllocationDecisionChainService;
use Modules\Operations\Loading\Domain\Services\VehicleInventoryService;
use Modules\Operations\Preparation\Domain\Models\PreparationWaveOrder;

/**
 * Automatically allocates pool inventory to vehicle assignments.
 *
 * Algorithm (per vehicle assignment):
 *   1. Find all VehicleInventoryItems (products physically on the vehicle).
 *   2. Derive which preparation wave(s) fed this vehicle from its LoadingTasks.
 *   3. Resolve which orders this vehicle should serve:
 *        a. VehiclePlanSlot orders (if slot assigned AND policy enabled), OR
 *        b. All wave orders, sorted by preparation_priority.
 *   4. For each order (in priority order):
 *        - Match its OrderLines to products on the vehicle.
 *        - Lock the VehicleInventoryItem and create an AllocationRecord.
 *        - Record the system allocation decision.
 *        - Deduct the allocated quantity from the vehicle's unallocated pool.
 *
 * Supports:
 *  - Multiple vehicles per session (iterates each VehicleAssignment)
 *  - Partial allocation (policy-gated; records is_partial = true + reason)
 *  - VehiclePlanSlot-based routing (policy flag)
 *  - Priority ordering of orders (policy flag)
 *  - Multi-company isolation (company_id scoped on every query)
 *  - Idempotency (skips order lines that already have an AllocationRecord)
 */
final class AutoAllocationService
{
    public function __construct(
        private readonly AllocationPolicyService $policy,
        private readonly AllocationDecisionChainService $decisions,
        private readonly VehicleInventoryService $vehicleInventory,
    ) {}

    /**
     * Run auto-allocation for every vehicle assignment in a loading session.
     *
     * @return array{records_created:int,partial_count:int,skipped_count:int,orders_allocated:int}
     */
    public function allocateSession(LoadingSession $session, string $actorId): array
    {
        $assignments = VehicleAssignment::where('loading_session_id', $session->id)->get();

        $totals = ['records_created' => 0, 'partial_count' => 0, 'skipped_count' => 0, 'orders_allocated' => 0];

        foreach ($assignments as $assignment) {
            $result = $this->allocateAssignment($assignment, $session->company_id, $actorId);
            foreach (array_keys($totals) as $key) {
                $totals[$key] += $result[$key];
            }
        }

        return $totals;
    }

    /**
     * Allocate a single vehicle assignment inside its own DB transaction.
     *
     * @return array{records_created:int,partial_count:int,skipped_count:int,orders_allocated:int}
     */
    private function allocateAssignment(
        VehicleAssignment $assignment,
        string $companyId,
        string $actorId,
    ): array {
        // Only products with unallocated quantity on this vehicle are candidates.
        $productIds = VehicleInventoryItem::where('vehicle_assignment_id', $assignment->id)
            ->where('quantity_unallocated', '>', 0)
            ->pluck('product_id')
            ->all();

        if (empty($productIds)) {
            return ['records_created' => 0, 'partial_count' => 0, 'skipped_count' => 0, 'orders_allocated' => 0];
        }

        // Derive the preparation wave(s) that supplied this vehicle.
        $waveIds = LoadingTask::where('vehicle_assignment_id', $assignment->id)
            ->distinct()
            ->pluck('preparation_wave_id')
            ->filter()
            ->values();

        if ($waveIds->isEmpty()) {
            return ['records_created' => 0, 'partial_count' => 0, 'skipped_count' => 0, 'orders_allocated' => 0];
        }

        $ordersData = $this->resolveOrdersForAssignment($assignment, $waveIds, $companyId);
        $usePriority = $this->policy->priorityAllocationEnabled($companyId);
        $allowPartial = $this->policy->allowsPartialAllocation($companyId);
        $maxPartialPct = $this->policy->maxPartialTolerancePct($companyId);
        $defaultMode = $this->policy->defaultMode($companyId);

        if ($usePriority) {
            $ordersData = $ordersData->sortBy('priority')->values();
        }

        return DB::transaction(function () use (
            $assignment, $companyId, $actorId, $productIds,
            $ordersData, $allowPartial, $maxPartialPct, $defaultMode,
        ): array {
            $recordsCreated = 0;
            $partialCount = 0;
            $skippedCount = 0;
            $allocatedOrders = [];

            foreach ($ordersData as $orderData) {
                $orderId = $orderData['order_id'];
                $orderNumber = $orderData['order_number'];
                $priority = $orderData['priority'];

                // Order lines that match products on this vehicle.
                $lines = OrderLine::where('order_id', $orderId)
                    ->whereIn('product_id', $productIds)
                    ->get();

                foreach ($lines as $line) {
                    // Skip if already allocated (idempotent).
                    if (AllocationRecord::where('vehicle_assignment_id', $assignment->id)
                        ->where('order_line_id', $line->id)
                        ->exists()
                    ) {
                        continue;
                    }

                    // Lock the inventory item for this product on this vehicle.
                    $item = VehicleInventoryItem::where('vehicle_assignment_id', $assignment->id)
                        ->where('product_id', $line->product_id)
                        ->lockForUpdate()
                        ->first();

                    if ($item === null || $item->quantity_unallocated <= 0) {
                        $skippedCount++;

                        continue;
                    }

                    $qtyRequested = (float) $line->quantity;
                    $qtyAvailable = (float) $item->quantity_unallocated;
                    $qtyAllocated = min($qtyRequested, $qtyAvailable);
                    $isPartial = $qtyAllocated < $qtyRequested;
                    $shortagePct = $qtyRequested > 0
                        ? ($qtyRequested - $qtyAllocated) / $qtyRequested
                        : 0.0;

                    if ($isPartial && ! $allowPartial) {
                        $skippedCount++;

                        continue;
                    }

                    if ($isPartial && $shortagePct > $maxPartialPct) {
                        $skippedCount++;

                        continue;
                    }

                    $mode = $isPartial ? AllocationMode::PartialAuto : $defaultMode;

                    $record = AllocationRecord::create([
                        'company_id' => $companyId,
                        'vehicle_assignment_id' => $assignment->id,
                        'loading_session_id' => $assignment->loading_session_id,
                        'vehicle_id' => $assignment->vehicle_id,
                        'order_id' => $orderId,
                        'order_line_id' => $line->id,
                        'order_number_snapshot' => $orderNumber,
                        'order_type_snapshot' => null,
                        'product_id' => $line->product_id,
                        'sku_snapshot' => $item->sku_snapshot,
                        'vehicle_inventory_item_id' => $item->id,
                        'allocation_mode' => $mode->value,
                        'priority_rank' => max(1, $priority),
                        'quantity_requested' => $qtyRequested,
                        'quantity_allocated' => $qtyAllocated,
                        'quantity_loaded' => 0.0,
                        'quantity_delivered' => 0.0,
                        'quantity_remaining' => $qtyAllocated,
                        'is_partial' => $isPartial,
                        'partial_reason' => $isPartial
                            ? "Vehicle {$assignment->assignment_number}: {$qtyAllocated} of {$qtyRequested} units available"
                            : null,
                        'status' => AllocationRecordStatus::Allocated->value,
                        'allocated_at' => now(),
                        'allocated_by' => 'system',
                        'allocated_by_user_id' => null,
                        'policy_evaluation_id' => null,
                        'created_by' => $actorId,
                        'updated_by' => $actorId,
                    ]);

                    // Record the initial system allocation decision.
                    $this->decisions->recordSystemAllocation($record, $qtyAllocated);

                    // Earmark the quantity on the vehicle inventory item.
                    $this->vehicleInventory->allocate($item, $record->id, $qtyAllocated, $actorId);

                    $recordsCreated++;
                    if ($isPartial) {
                        $partialCount++;
                    }
                    $allocatedOrders[$orderId] = true;
                }
            }

            return [
                'records_created' => $recordsCreated,
                'partial_count' => $partialCount,
                'skipped_count' => $skippedCount,
                'orders_allocated' => count($allocatedOrders),
            ];
        });
    }

    /**
     * Determine the ordered set of orders that this vehicle assignment should serve.
     *
     * Strategy 1 — VehiclePlanSlot (if slot is assigned AND policy flag is on):
     *   Uses the stop sequence from VehiclePlanSlotOrder as the priority value.
     *
     * Strategy 2 — Wave orders (default / fallback):
     *   Loads all PreparationWaveOrders from every wave that supplied this vehicle,
     *   using preparation_priority as the sort key.
     *
     * @param  Collection<int, string>  $waveIds
     * @return Collection<int, array{order_id:string,order_number:string,priority:int}>
     */
    private function resolveOrdersForAssignment(
        VehicleAssignment $assignment,
        Collection $waveIds,
        string $companyId,
    ): Collection {
        if ($assignment->vehicle_plan_slot_id !== null
            && $this->policy->useVehiclePlanSlots($companyId)
        ) {
            return VehiclePlanSlotOrder::where('vehicle_plan_slot_id', $assignment->vehicle_plan_slot_id)
                ->get()
                ->map(fn ($row) => [
                    'order_id' => $row->order_id,
                    'order_number' => $row->order_number_snapshot,
                    'priority' => $row->stop_sequence ?? 99,
                ]);
        }

        return PreparationWaveOrder::whereIn('preparation_wave_id', $waveIds->all())
            ->where('company_id', $companyId)
            ->get()
            ->map(fn ($row) => [
                'order_id' => $row->order_id,
                'order_number' => $row->order_number,
                'priority' => (int) $row->preparation_priority,
            ]);
    }
}
