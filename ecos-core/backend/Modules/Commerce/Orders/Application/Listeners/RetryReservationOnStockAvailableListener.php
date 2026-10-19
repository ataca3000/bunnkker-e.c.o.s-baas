<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Application\Listeners;

use Illuminate\Support\Facades\Log;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Enums\ReservationStatus;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Inventory\DomainEvents\Events\InventoryStockReceived;
use Modules\Operations\Fulfillment\Application\FulfillmentEngine;
use Modules\Operations\Fulfillment\Application\Workflows\ProcessOrderWorkflow;
use Throwable;

/**
 * TASK-INV-RESERVATION-LIFECYCLE-001 — Part 4
 *
 * When new inventory arrives, automatically retry reservation for all orders
 * that are currently awaiting stock in the same warehouse.
 *
 * P7 fix: replaced direct $order->update(['status' => Processing]) with
 * FulfillmentEngine::run(ProcessOrderWorkflow) so that the full reservation
 * pipeline is honoured. ProcessOrderWorkflow's idempotency check skips
 * re-reservation when reservation_status is already Reserved/PartialReserved.
 */
final class RetryReservationOnStockAvailableListener
{
    public function __construct(
        private readonly FulfillmentEngine $fulfillmentEngine,
        private readonly ProcessOrderWorkflow $processWorkflow,
    ) {}

    public function handle(InventoryStockReceived $event): void
    {
        // Find all orders awaiting stock for this product in this warehouse.
        $candidates = Order::where('status', OrderStatus::AwaitingStock)
            ->where('assigned_warehouse_id', $event->warehouseId)
            ->whereNull('deleted_at')
            ->whereIn('reservation_status', [
                ReservationStatus::AwaitingStock->value,
                ReservationStatus::Pending->value,
            ])
            ->whereHas('lines', fn ($q) => $q->where('product_id', $event->productId))
            ->get();

        foreach ($candidates as $order) {
            try {
                // ProcessOrderWorkflow attempts reservation and — if successful —
                // transitions status to Processing. Its idempotency check means if
                // reservation is already Reserved (from a prior partial), it skips re-reservation.
                $result = $this->fulfillmentEngine->run(
                    $this->processWorkflow,
                    $order,
                    [],
                    null, // system actor
                );

                Log::info("[RetryReservation] Order #{$order->order_number} processed after stock receipt.", [
                    'order_id' => $order->id,
                    'new_status' => $result->order->status->value,
                    'product_id' => $event->productId,
                    'warehouse_id' => $event->warehouseId,
                ]);
            } catch (Throwable $e) {
                // Never let a single order failure halt the retry loop.
                Log::error("[RetryReservation] Failed to process order #{$order->order_number} after stock receipt.", [
                    'order_id' => $order->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
