<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Workflows;

use Illuminate\Support\Facades\DB;
use Modules\Commerce\Orders\Application\Actions\ShipOrderInventoryAction;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Orders\Domain\Models\OrderEvent;
use Modules\Operations\Fulfillment\Application\OrderStatusGuard;
use Modules\Operations\Fulfillment\Domain\Events\OrderDispatchedEvent;
use Modules\Operations\Loading\Domain\Models\AllocationRecord;
use Modules\Operations\Loading\Domain\Models\DriverAssignment;
use Modules\Operations\Loading\Domain\Models\VehicleAssignment;

/**
 * Ships inventory for every order on a vehicle when it is dispatched.
 *
 * Closes GAP-02 (ShipOrderInventoryAction never called for manual orders) and
 * GAP-03 (VehicleInventoryService disconnected from main InventoryItem system).
 *
 * This is NOT an FulfillmentWorkflowInterface implementor — it operates on a
 * VehicleAssignment (multiple orders) rather than a single Order. It is called
 * directly from DispatchVehicleAction inside that action's transaction.
 */
final class LoadVehicleWorkflow
{
    public function __construct(
        private readonly ShipOrderInventoryAction $shipInventory,
    ) {}

    /**
     * Ship inventory for all orders loaded onto this vehicle assignment.
     *
     * @return list<Order> Orders successfully transitioned to out_for_delivery.
     */
    public function execute(VehicleAssignment $assignment, string $actorId): array
    {
        $orderIds = AllocationRecord::where('vehicle_assignment_id', $assignment->id)
            ->distinct()
            ->pluck('order_id');

        if ($orderIds->isEmpty()) {
            return [];
        }

        // P1-004 — Resolve the active driver for this vehicle assignment.
        // DriverAssignment is created by AssignDriverAction; use the most recent active one.
        $driverAssignment = DriverAssignment::where('vehicle_assignment_id', $assignment->id)
            ->orderByDesc('assigned_at')
            ->first();
        $driverId = $driverAssignment?->driver_id;

        // P1-001 — Build per-order line-quantity maps from AllocationRecord.
        // Each vehicle ships only the quantities it was allocated, not the full reserved_qty.
        // This supports split-shipment: one order across multiple vehicles.
        $allocationsByOrder = AllocationRecord::where('vehicle_assignment_id', $assignment->id)
            ->get(['order_id', 'order_line_id', 'quantity_allocated'])
            ->groupBy('order_id')
            ->map(fn ($records) => $records->keyBy('order_line_id')->map(fn ($r) => (float) $r->quantity_allocated)->toArray());

        $shipped = [];

        // All orders on this vehicle ship atomically — one failure rolls back all.
        // This runs as a savepoint inside DispatchVehicleAction's outer transaction.
        //
        // OrderStatusGuard::withAuthorization() is required here because LoadVehicleWorkflow
        // is NOT a FulfillmentWorkflowInterface implementor — it operates on a VehicleAssignment
        // (multiple orders with per-line allocation quantities), not a single order.
        // It is an explicitly authorized status writer: vehicle dispatch is a documented
        // exception to the single-order engine pattern.
        OrderStatusGuard::withAuthorization(function () use ($orderIds, $allocationsByOrder, &$shipped): void {
            DB::transaction(function () use ($orderIds, $allocationsByOrder, &$shipped): void {
                foreach ($orderIds as $orderId) {
                    $order = Order::find($orderId);

                    if ($order === null) {
                        continue;
                    }

                    // Idempotent — skip if already shipped (e.g. partial re-dispatch)
                    if ($order->inventory_shipped_at !== null) {
                        continue;
                    }

                    // Pass the per-line allocation quantities so only the vehicle's share is consumed.
                    // If no allocation map exists for this order (edge case), fall back to full reserved_qty.
                    $lineQuantities = $allocationsByOrder[$orderId] ?? null;

                    $this->shipInventory->execute($order, $lineQuantities);

                    $order->update(['status' => OrderStatus::OutForDelivery]);
                    $order->refresh();

                    $shipped[] = $order;
                }
            });
        });

        // Audit trail + events after the savepoint releases
        foreach ($shipped as $order) {
            OrderEvent::log(
                orderId: $order->id,
                type: 'load_vehicle',
                description: "Order #{$order->order_number} inventory shipped. Vehicle {$assignment->assignment_number} dispatched.",
                payload: [
                    'vehicle_assignment_id' => $assignment->id,
                    'driver_id' => $driverId,
                ],
                actorId: $actorId,
            );

            event(new OrderDispatchedEvent(
                orderId: $order->id,
                orderNumber: $order->order_number,
                companyId: $order->company_id ?? '',
                vehicleAssignmentId: $assignment->id,
                vehicleId: $assignment->vehicle_id,
                driverId: $driverId,
                cogsAmount: (float) ($order->actual_cogs_amount ?? 0),
                dispatchedAt: now()->toIso8601String(),
                actorId: $actorId,
            ));
        }

        return $shipped;
    }
}
