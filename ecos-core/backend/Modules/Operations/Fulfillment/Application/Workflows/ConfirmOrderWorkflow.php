<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Workflows;

use Modules\Commerce\Orders\Application\Actions\ReserveOrderInventoryAction;
use Modules\Commerce\Orders\Application\Actions\UpdateReservationStatusAction;
use Modules\Commerce\Orders\Application\Services\CreateOrderSnapshotService;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Enums\ReservationStatus;
use Modules\Commerce\Orders\Domain\Models\OrderEvent;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentContext;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentResult;
use Modules\Operations\Fulfillment\Domain\Contracts\FulfillmentWorkflowInterface;
use Modules\Operations\Fulfillment\Domain\Events\OrderConfirmedEvent;
use Modules\Operations\Fulfillment\Domain\Exceptions\WorkflowPreconditionException;

/**
 * Legacy confirm workflow — retained for direct invocation compatibility.
 *
 * V3 (TASK-ORDERS-LIFECYCLE-ARCH-002): Confirmed status removed. This workflow
 * now writes InProgress. The canonical auto-initiation path uses ProcessOrderWorkflow
 * (name: 'initiate_order'). This workflow is preserved for callers that explicitly
 * name 'confirm_order' and for the financial snapshot creation path.
 */
final class ConfirmOrderWorkflow implements FulfillmentWorkflowInterface
{
    public function __construct(
        private readonly ReserveOrderInventoryAction $reserveInventory,
        private readonly CreateOrderSnapshotService $snapshot,
        private readonly UpdateReservationStatusAction $updateReservationStatus,
    ) {}

    public function guard(FulfillmentContext $ctx): void
    {
        $order = $ctx->order;

        $allowed = [
            OrderStatus::NewOrder,
            OrderStatus::AwaitingPayment,
            OrderStatus::AwaitingStock,
            OrderStatus::OnHold,
            OrderStatus::Returned,
            OrderStatus::Cancelled,
            OrderStatus::InProgress,
        ];

        if (! in_array($order->status, $allowed, true)) {
            throw new WorkflowPreconditionException(
                "Order [{$order->id}] cannot be initiated from status [{$order->status->value}].",
            );
        }
    }

    public function execute(FulfillmentContext $ctx): FulfillmentResult
    {
        $order = $ctx->order;

        // Returned orders had inventory released — reset lifecycle fields before re-reserving.
        if ($order->status === OrderStatus::Returned) {
            $order->update([
                'inventory_reserved_at'    => null,
                'inventory_released_at'    => null,
                'inventory_shipped_at'     => null,
                'reservation_status'       => null,
                'reservation_failure_reason' => null,
            ]);
            $order->refresh();
        }

        // Clear on_hold / cancel metadata on re-activation
        if (in_array($order->status, [OrderStatus::OnHold, OrderStatus::Cancelled], true)) {
            $order->update([
                'rescheduled_at'     => null,
                'next_delivery_date' => null,
                'resume_from_status' => null,
                'reschedule_reason'  => null,
            ]);
            $order->refresh();
        }

        $activeStates    = [ReservationStatus::Reserved, ReservationStatus::PartialReserved];
        $alreadyReserved = in_array($order->reservation_status, $activeStates, true);

        $snapshotCreated = false;

        if (! $alreadyReserved) {
            if ($order->assigned_warehouse_id === null) {
                $order->update(['status' => OrderStatus::AwaitingStock]);
                $order->refresh();

                $this->updateReservationStatus->execute(
                    $order,
                    ReservationStatus::AwaitingStock,
                    'Warehouse Not Assigned',
                );

                OrderEvent::log(
                    orderId: $order->id,
                    type: 'reservation_awaiting_stock',
                    description: "Reservation pending for order #{$order->order_number}: no warehouse assigned.",
                    payload: ['reason' => 'no_warehouse_assigned'],
                    module: 'fulfillment',
                );

                return FulfillmentResult::success(
                    $order,
                    "Order #{$order->order_number} awaiting stock — no warehouse assigned.",
                    ['snapshot_created' => false, 'actor_id' => $ctx->actorId, 'reservation_failed' => true],
                );
            }

            $reservationStatus = $this->reserveInventory->execute($order);
            $order->refresh();

            if ($reservationStatus === ReservationStatus::AwaitingStock) {
                $order->update(['status' => OrderStatus::AwaitingStock]);
                $order->refresh();

                return FulfillmentResult::success(
                    $order,
                    "Order #{$order->order_number} awaiting stock — insufficient inventory.",
                    ['snapshot_created' => false, 'actor_id' => $ctx->actorId, 'reservation_failed' => true],
                );
            }

            $snapshot = $this->snapshot->createIfAbsent($order);
            $snapshotCreated = $snapshot !== null;
        }

        $order->update(['status' => OrderStatus::InProgress]);
        $order->refresh();

        $message = $alreadyReserved
            ? "Order #{$order->order_number} moved to In Progress."
            : "Order #{$order->order_number} moved to In Progress. Inventory reserved.";

        return FulfillmentResult::success(
            $order,
            $message,
            ['snapshot_created' => $snapshotCreated, 'actor_id' => $ctx->actorId],
        );
    }

    /** @return list<object> */
    public function events(FulfillmentResult $result): array
    {
        if ($result->meta['reservation_failed'] ?? false) {
            return [];
        }

        return [
            new OrderConfirmedEvent(
                orderId: $result->order->id,
                orderNumber: $result->order->order_number,
                companyId: $result->order->company_id ?? '',
                warehouseId: $result->order->assigned_warehouse_id ?? '',
                reservedAt: $result->order->inventory_reserved_at?->toIso8601String() ?? now()->toIso8601String(),
                snapshotCreated: (bool) ($result->meta['snapshot_created'] ?? false),
                actorId: $result->meta['actor_id'] ?? null,
            ),
        ];
    }

    public function name(): string
    {
        return 'confirm_order';
    }
}
