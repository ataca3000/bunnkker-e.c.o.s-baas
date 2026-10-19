<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Workflows;

use Modules\Commerce\Orders\Application\Actions\UpdateReservationStatusAction;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Enums\ReservationStatus;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentContext;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentResult;
use Modules\Operations\Fulfillment\Domain\Contracts\FulfillmentWorkflowInterface;
use Modules\Operations\Fulfillment\Domain\Exceptions\WorkflowPreconditionException;

/**
 * Marks an order as waiting for inventory.
 *
 * V3 (TASK-ORDERS-LIFECYCLE-ARCH-002): Updated allowed statuses for new lifecycle.
 * The order automatically returns to In Progress once inventory becomes available
 * (handled by the inventory replenishment event listener).
 */
final class MarkAwaitingStockWorkflow implements FulfillmentWorkflowInterface
{
    public function __construct(
        private readonly UpdateReservationStatusAction $updateReservationStatus,
    ) {}

    public function guard(FulfillmentContext $ctx): void
    {
        $order = $ctx->order;

        $allowed = [
            OrderStatus::NewOrder,
            OrderStatus::AwaitingPayment,
            OrderStatus::InProgress,
            OrderStatus::OnHold,
            OrderStatus::Scheduled,
            OrderStatus::Cancelled,
        ];

        if (! in_array($order->status, $allowed, true)) {
            throw new WorkflowPreconditionException(
                "Order [{$order->id}] cannot be moved to awaiting_stock from [{$order->status->value}].",
            );
        }
    }

    public function execute(FulfillmentContext $ctx): FulfillmentResult
    {
        $order = $ctx->order;
        $reason = $ctx->get('reason') ?? 'Insufficient stock.';

        $order->update(['status' => OrderStatus::AwaitingStock]);
        $order->refresh();

        $this->updateReservationStatus->execute(
            $order,
            ReservationStatus::AwaitingStock,
            $reason,
        );

        return FulfillmentResult::success(
            $order,
            "Order #{$order->order_number} is awaiting stock replenishment.",
            ['reason' => $reason, 'actor_id' => $ctx->actorId],
        );
    }

    /** @return list<object> */
    public function events(FulfillmentResult $result): array
    {
        return [];
    }

    public function name(): string
    {
        return 'mark_awaiting_stock';
    }
}
