<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Application\Actions;

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Modules\Commerce\Orders\Domain\Enums\ReservationStatus;
use Modules\Commerce\Orders\Domain\Exceptions\OrderWarehouseNotAssignedException;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Orders\Domain\Models\OrderEvent;
use Modules\Commerce\Orders\Domain\Models\OrderReservationAudit;
use Modules\Inventory\InventoryItems\Application\Actions\ReserveStockAction;
use Modules\Inventory\InventoryItems\Application\DTO\StockOperationDTO;
use Modules\Inventory\InventoryItems\Domain\Exceptions\InsufficientStockException;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;

/**
 * TASK-INV-RESERVATION-LIFECYCLE-001 — Part 2, 3, 4
 *
 * Attempts to reserve inventory for every order line.
 * Supports partial reservation: reserves as much as is available per line.
 *
 * Returns the resulting ReservationStatus so callers can branch without catching.
 *
 * Outcomes:
 *   reserved         — every line fully satisfied (physically or via manufacturing eligibility)
 *   partial_reserved — some lines satisfied, some not
 *   awaiting_stock   — no lines could be satisfied
 *
 * Does NOT throw InsufficientStockException for insufficient stock — that
 * concern has moved to the returned status.
 *
 * Policy (Cases 1–3): Reservation decides from the Finished Product only.
 * can_manufacture=true commits reservation unconditionally — Manufacturing evaluates
 * RM availability in PrepareOrderManufacturingAction after the order enters Preparing.
 * No Raw Material condition may move an order to Awaiting Stock.
 */
final class ReserveOrderInventoryAction
{
    public function __construct(
        private readonly ReserveStockAction $reserveStock,
    ) {}

    public function execute(Order $order): ReservationStatus
    {
        // Idempotency: already in a terminal-for-reservation state → skip
        $currentStatus = $order->reservation_status;
        if ($currentStatus !== null) {
            $skipStates = [
                ReservationStatus::Reserved,
                ReservationStatus::Transferred,
                ReservationStatus::Consumed,
                ReservationStatus::Released,
            ];
            if (in_array($currentStatus, $skipStates, true)) {
                return $currentStatus;
            }
        }

        if ($order->assigned_warehouse_id === null) {
            throw new OrderWarehouseNotAssignedException($order->id);
        }

        $order->loadMissing('lines.product', 'assignedWarehouse');
        $companyId = $order->assignedWarehouse->company_id;
        $warehouseId = $order->assigned_warehouse_id;
        $totalLines = $order->lines->count();

        // The entire reservation unit — per-line stock locks, order.reservation_status,
        // inventory_reserved_at, OrderReservationAudit, and OrderEvent — is committed in
        // one DB::transaction so no partial state can persist if any step fails.
        // When called from a FulfillmentEngine workflow, this becomes a savepoint inside
        // the outer FE transaction, preserving full atomicity with the order status update.
        return DB::transaction(function () use (
            $order, $companyId, $warehouseId, $totalLines,
        ): ReservationStatus {
            $reservedLines = 0;
            $partialLines = 0;
            $skippedLines = 0;
            $failReason = null;
            $metaLines = [];

            foreach ($order->lines as $line) {
                $requested = (float) $line->quantity;
                if ($requested <= 0) {
                    $skippedLines++;

                    continue;
                }

                // Determine how much FG stock is physically available (no lock — pre-check)
                $item = InventoryItem::where('warehouse_id', $warehouseId)
                    ->where('product_id', $line->product_id)
                    ->first();
                $available = $item ? max(0.0, $item->availableQty()) : 0.0;

                // CASE 1: Sufficient FG stock — reserve physically, done
                if ($available >= $requested) {
                    try {
                        $this->reserveStock->execute(new StockOperationDTO(
                            warehouse_id: $warehouseId,
                            product_id: $line->product_id,
                            company_id: $companyId,
                            quantity: $requested,
                            reference_type: 'sales_order',
                            reference_id: $order->id,
                            notes: "Reserved for order #{$order->order_number}",
                        ));
                    } catch (InsufficientStockException) {
                        // BUG-36/M-4 fix: stock dropped between the unlocked pre-check
                        // and the lockForUpdate inside ReserveStockAction — treat as partial.
                        $skippedLines++;
                        $failReason ??= 'Insufficient Inventory';
                        $metaLines[] = ['product_id' => $line->product_id, 'requested' => $requested, 'reserved' => 0.0, 'outcome' => 'none'];

                        continue;
                    }
                    $line->update(['reserved_qty' => $requested]);
                    $reservedLines++;
                    $metaLines[] = ['product_id' => $line->product_id, 'requested' => $requested, 'reserved' => $requested, 'outcome' => 'full'];

                    continue;
                }

                // FG stock is insufficient — check manufacturing eligibility first
                $product = $line->product;

                if ($product?->can_manufacture) {
                    // TASK-ORDER-RESERVATION-ARCH-FIX-001: Policy (Case 3).
                    // can_manufacture=true → Reserve Finished Product commitment unconditionally.
                    // Manufacturing owns all Raw Material decisions; no RM condition gates reservation.
                    // PrepareOrderManufacturingAction evaluates RM after the order enters Preparing.
                    if ($available > 0.0) {
                        try {
                            $this->reserveStock->execute(new StockOperationDTO(
                                warehouse_id: $warehouseId,
                                product_id: $line->product_id,
                                company_id: $companyId,
                                quantity: $available,
                                reference_type: 'sales_order',
                                reference_id: $order->id,
                                notes: "Reserved for order #{$order->order_number} (partial FG; remainder via manufacturing)",
                            ));
                        } catch (InsufficientStockException) {
                            // TOCTOU race — treat as zero FG available; manufacturing covers the full quantity.
                        }
                    }
                    $line->update(['reserved_qty' => $requested]);
                    $reservedLines++;
                    $metaLines[] = ['product_id' => $line->product_id, 'requested' => $requested, 'reserved' => $available, 'outcome' => 'manufacturing_committed'];

                    continue;
                }

                // TASK-REGRESSION-NEGATIVE-RESERVATION-001: allow_negative_stock on a
                // finished good commits the full ordered quantity as reserved regardless
                // of on-hand qty. Lock any physically available units first; the
                // remainder is a logical commitment that drives inventory negative at
                // shipment time (DirectIssue path).
                if ($product?->allow_negative_stock) {
                    if ($available > 0.0) {
                        try {
                            $this->reserveStock->execute(new StockOperationDTO(
                                warehouse_id: $warehouseId,
                                product_id: $line->product_id,
                                company_id: $companyId,
                                quantity: $available,
                                reference_type: 'sales_order',
                                reference_id: $order->id,
                                notes: "Reserved for order #{$order->order_number} (partial physical; remainder via negative stock)",
                            ));
                        } catch (InsufficientStockException) {
                            // TOCTOU race — stock dropped between pre-check and lock.
                        }
                    }
                    $line->update(['reserved_qty' => $requested]);
                    $reservedLines++;
                    $metaLines[] = ['product_id' => $line->product_id, 'requested' => $requested, 'reserved' => $requested, 'outcome' => 'negative_stock_committed'];

                    continue;
                }

                // Non-manufactured product with insufficient stock
                if ($available <= 0.0) {
                    $skippedLines++;
                    $failReason ??= 'Insufficient Inventory';
                    $metaLines[] = ['product_id' => $line->product_id, 'requested' => $requested, 'reserved' => 0.0, 'outcome' => 'none'];

                    continue;
                }

                // Partial physical reserve (available > 0 but < requested).
                // BUG-36 fix: wrap in try-catch — stock can drop to zero between the unlocked
                // pre-check above and the lockForUpdate inside ReserveStockAction. When that
                // race fires, treat as AwaitingStock (skipped) instead of propagating a 500.
                try {
                    $this->reserveStock->execute(new StockOperationDTO(
                        warehouse_id: $warehouseId,
                        product_id: $line->product_id,
                        company_id: $companyId,
                        quantity: $available,
                        reference_type: 'sales_order',
                        reference_id: $order->id,
                        notes: "Reserved for order #{$order->order_number}",
                    ));
                    $line->update(['reserved_qty' => $available]);
                    $partialLines++;
                    $metaLines[] = ['product_id' => $line->product_id, 'requested' => $requested, 'reserved' => $available, 'outcome' => 'partial'];
                } catch (InsufficientStockException) {
                    $skippedLines++;
                    $metaLines[] = ['product_id' => $line->product_id, 'requested' => $requested, 'reserved' => 0.0, 'outcome' => 'none'];
                }
                $failReason ??= 'Insufficient Inventory';
            }

            // ── Determine new status ─────────────────────────────────────────────
            $fulfilledLines = $reservedLines + $partialLines;

            $newStatus = match (true) {
                $fulfilledLines === 0 => ReservationStatus::AwaitingStock,
                $reservedLines === $totalLines - $skippedLines => ReservationStatus::Reserved,
                default => ReservationStatus::PartialReserved,
            };

            // ── Persist + audit ──────────────────────────────────────────────────
            $previousStatus = $order->reservation_status?->value;

            $order->update([
                'inventory_reserved_at' => now(),
                'reservation_status' => $newStatus->value,
                'reservation_failure_reason' => in_array($newStatus, [ReservationStatus::AwaitingStock, ReservationStatus::PartialReserved], true)
                    ? $failReason
                    : null,
            ]);

            OrderReservationAudit::record(
                orderId: $order->id,
                fromStatus: $previousStatus,
                toStatus: $newStatus->value,
                reason: $failReason,
                warehouseId: $order->assigned_warehouse_id,
                meta: ['lines' => $metaLines, 'total_lines' => $totalLines, 'reserved_lines' => $reservedLines, 'partial_lines' => $partialLines],
                actorId: Auth::id(),
                actorType: Auth::check() ? 'user' : 'system',
            );

            OrderEvent::log(
                orderId: $order->id,
                type: 'reservation_'.$newStatus->value,
                description: match ($newStatus) {
                    ReservationStatus::Reserved => "Inventory fully reserved for order #{$order->order_number}.",
                    ReservationStatus::PartialReserved => "Inventory partially reserved for order #{$order->order_number}: {$reservedLines} full, {$partialLines} partial, {$skippedLines} pending.",
                    ReservationStatus::AwaitingStock => "No inventory available for order #{$order->order_number}. Awaiting stock.",
                    default => "Reservation status updated to {$newStatus->value}.",
                },
                payload: ['warehouse_id' => $warehouseId, 'lines' => $metaLines],
                module: 'orders',
                actionType: 'inventory',
            );

            return $newStatus;
        });
    }
}
