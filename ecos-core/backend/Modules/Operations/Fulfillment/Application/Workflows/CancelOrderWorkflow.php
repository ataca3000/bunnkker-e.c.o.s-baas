<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Workflows;

use Modules\Commerce\Orders\Application\Actions\ReleaseOrderInventoryAction;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentContext;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentResult;
use Modules\Operations\Fulfillment\Domain\Contracts\FulfillmentWorkflowInterface;
use Modules\Operations\Fulfillment\Domain\Events\OrderCancelledEvent;
use Modules\Operations\Fulfillment\Domain\Exceptions\WorkflowPreconditionException;

/**
 * Cancels an order and releases any held inventory reservation.
 *
 * V3 (TASK-ORDERS-LIFECYCLE-ARCH-002):
 * - New / AwaitingPayment / InProgress / AwaitingStock / OnHold / Scheduled:
 *   release reservation, cancel.
 * - ReadyForDispatch: BLOCKED unless force_cancel_preparation=true (preparation work done).
 * - OutForDelivery: BLOCKED — must execute Return Workflow first.
 * - Delivered / Returned: already terminal.
 */
final class CancelOrderWorkflow implements FulfillmentWorkflowInterface
{
    public function __construct(
        private readonly ReleaseOrderInventoryAction $releaseInventory,
    ) {}

    public function guard(FulfillmentContext $ctx): void
    {
        $order = $ctx->order;

        if ($order->status === OrderStatus::OutForDelivery) {
            throw new WorkflowPreconditionException(
                "Order [{$order->id}] is out for delivery. Execute Return Workflow first before cancelling.",
            );
        }

        $blocked = [
            OrderStatus::Cancelled,
            OrderStatus::Delivered,
            OrderStatus::Returned,
        ];

        if (in_array($order->status, $blocked, true)) {
            throw new WorkflowPreconditionException(
                "Order [{$order->id}] is in state [{$order->status->value}] and cannot be cancelled.",
            );
        }

        // Ready for Dispatch: physical preparation work is complete. Require explicit confirmation.
        if ($order->status === OrderStatus::ReadyForDispatch) {
            $forced = (bool) ($ctx->get('force_cancel_preparation') ?? false);
            if (! $forced) {
                throw new WorkflowPreconditionException(
                    "Order [{$order->id}] is ready for dispatch — preparation work is complete. Pass force_cancel_preparation=true to confirm cancellation.",
                );
            }
        }
    }

    public function execute(FulfillmentContext $ctx): FulfillmentResult
    {
        $order = $ctx->order;
        $reason = $ctx->get('reason');
        $released = false;

        if ($order->assigned_warehouse_id !== null && $order->inventory_released_at === null) {
            $this->releaseInventory->execute($order);
            $released = true;
            $order->refresh();
        }

        $order->update(['status' => OrderStatus::Cancelled]);
        $order->refresh();

        return FulfillmentResult::success(
            $order,
            "Order #{$order->order_number} cancelled.".($released ? ' Inventory reservation released.' : ''),
            [
                'inventory_released' => $released,
                'reason'             => $reason,
                'actor_id'           => $ctx->actorId,
            ],
        );
    }

    /** @return list<object> */
    public function events(FulfillmentResult $result): array
    {
        return [
            new OrderCancelledEvent(
                orderId: $result->order->id,
                orderNumber: $result->order->order_number,
                companyId: $result->order->company_id ?? '',
                inventoryReleased: (bool) ($result->meta['inventory_released'] ?? false),
                reason: $result->meta['reason'] ?? null,
                cancelledAt: now()->toIso8601String(),
                actorId: $result->meta['actor_id'] ?? null,
            ),
        ];
    }

    public function name(): string
    {
        return 'cancel_order';
    }
}
