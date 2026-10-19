<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Workflows;

use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentContext;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentResult;
use Modules\Operations\Fulfillment\Domain\Contracts\FulfillmentWorkflowInterface;
use Modules\Operations\Fulfillment\Domain\Exceptions\WorkflowPreconditionException;

/**
 * Places an order On Hold for manual intervention.
 *
 * V3 (TASK-ORDERS-LIFECYCLE-ARCH-002): Renamed from "Review" to "On Hold".
 * On Hold is a non-terminal hold state. Valid exits:
 *   → In Progress (via ProcessOrderWorkflow)
 *   → New        (via ReturnToPendingWorkflow)
 *   → Cancelled  (via CancelOrderWorkflow)
 */
final class MoveToReviewWorkflow implements FulfillmentWorkflowInterface
{
    public function guard(FulfillmentContext $ctx): void
    {
        $order = $ctx->order;

        $blocked = [
            OrderStatus::OnHold,           // already on hold
            OrderStatus::ReadyForDispatch, // locked in execution chain
            OrderStatus::OutForDelivery,   // locked in execution chain
            OrderStatus::Delivered,        // terminal
            OrderStatus::Returned,         // handled by Returns workflow
        ];

        if (in_array($order->status, $blocked, true)) {
            throw new WorkflowPreconditionException(
                "Order [{$order->id}] cannot be placed On Hold from status [{$order->status->value}].",
            );
        }
    }

    public function execute(FulfillmentContext $ctx): FulfillmentResult
    {
        $order = $ctx->order;
        $reason = $ctx->get('reason');

        $order->update(['status' => OrderStatus::OnHold]);
        $order->refresh();

        return FulfillmentResult::success(
            $order,
            "Order #{$order->order_number} placed on hold.",
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
        return 'put_on_hold';
    }
}
