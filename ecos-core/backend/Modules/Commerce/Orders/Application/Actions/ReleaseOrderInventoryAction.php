<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Application\Actions;

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Modules\Commerce\Orders\Domain\Enums\ReservationStatus;
use Modules\Commerce\Orders\Domain\Exceptions\OrderAlreadyReleasedException;
use Modules\Commerce\Orders\Domain\Exceptions\OrderWarehouseNotAssignedException;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Orders\Domain\Models\OrderEvent;
use Modules\Commerce\Orders\Domain\Models\OrderReservationAudit;
use Modules\Inventory\InventoryItems\Application\Actions\ReleaseStockAction;
use Modules\Inventory\InventoryItems\Application\DTO\StockOperationDTO;

final class ReleaseOrderInventoryAction
{
    public function __construct(private readonly ReleaseStockAction $releaseStock) {}

    public function execute(Order $order): void
    {
        if ($order->inventory_released_at !== null) {
            throw new OrderAlreadyReleasedException($order->id);
        }

        if ($order->assigned_warehouse_id === null) {
            throw new OrderWarehouseNotAssignedException($order->id);
        }

        $previousStatus = $order->reservation_status?->value;

        // Never reserved (pending/awaiting_stock) → just stamp release, nothing to un-reserve
        if ($order->inventory_reserved_at === null) {
            $order->update([
                'inventory_released_at' => now(),
                'reservation_status' => ReservationStatus::Released->value,
                'reservation_failure_reason' => null,
            ]);

            OrderReservationAudit::record(
                orderId: $order->id,
                fromStatus: $previousStatus,
                toStatus: ReservationStatus::Released->value,
                reason: 'Order cancelled before reservation',
                actorId: Auth::id(),
                actorType: Auth::check() ? 'user' : 'system',
            );

            OrderEvent::log(
                orderId: $order->id,
                type: 'reservation_released',
                description: "Inventory reservation released for order #{$order->order_number} (was not reserved).",
                payload: ['warehouse_id' => $order->assigned_warehouse_id],
                module: 'orders',
            );

            return;
        }

        $order->loadMissing('lines', 'assignedWarehouse');

        $companyId = $order->assignedWarehouse->company_id;

        // The entire release unit — per-line stock unlocks, order.reservation_status,
        // inventory_released_at, OrderReservationAudit, and OrderEvent — is committed in
        // one DB::transaction. When called from a FulfillmentEngine workflow, this becomes
        // a savepoint inside the outer FE transaction for full atomicity with order status.
        DB::transaction(function () use ($order, $companyId, $previousStatus): void {
            foreach ($order->lines as $line) {
                // Use the actual reserved quantity, not the originally requested quantity.
                // For partial reservations, reserved_qty = min(requested, available).
                // Releasing the full requested quantity would drive reserved_qty negative
                // and throw NegativeInventoryException, making cancellation impossible.
                $qtyToRelease = (float) ($line->reserved_qty ?? 0.0);

                if ($qtyToRelease <= 0.0) {
                    continue;
                }

                $this->releaseStock->execute(new StockOperationDTO(
                    warehouse_id: $order->assigned_warehouse_id,
                    product_id: $line->product_id,
                    company_id: $companyId,
                    quantity: $qtyToRelease,
                    reference_type: 'sales_order',
                    reference_id: $order->id,
                    notes: "Released reservation for order #{$order->order_number}",
                ));
            }

            $order->update([
                'inventory_released_at' => now(),
                'reservation_status' => ReservationStatus::Released->value,
                'reservation_failure_reason' => null,
            ]);

            OrderReservationAudit::record(
                orderId: $order->id,
                fromStatus: $previousStatus,
                toStatus: ReservationStatus::Released->value,
                warehouseId: $order->assigned_warehouse_id,
                meta: ['line_count' => $order->lines->count()],
                actorId: Auth::id(),
                actorType: Auth::check() ? 'user' : 'system',
            );

            OrderEvent::log(
                orderId: $order->id,
                type: 'reservation_released',
                description: "Inventory reservation released for order #{$order->order_number}.",
                payload: ['warehouse_id' => $order->assigned_warehouse_id, 'line_count' => $order->lines->count()],
                module: 'orders',
            );
        });
    }
}
