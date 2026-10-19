<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Workflows;

use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentContext;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentResult;
use Modules\Operations\Fulfillment\Domain\Contracts\FulfillmentWorkflowInterface;
use Modules\Operations\Fulfillment\Domain\Exceptions\WorkflowPreconditionException;

/**
 * V2: Marks an order as Rescheduled from any pre-execution state.
 *
 * This is a lightweight version of RescheduleOrderWorkflow for use in the
 * Smart Status Selector. It sets the status to Rescheduled without requiring
 * a delivery date (date updates can be handled separately via the reschedule
 * endpoint). Any existing inventory reservation is preserved.
 */
final class MarkRescheduledWorkflow implements FulfillmentWorkflowInterface
{
    public function guard(FulfillmentContext $ctx): void
    {
        $blocked = [
            OrderStatus::Scheduled,          // already in this state
            OrderStatus::ReadyForDispatch,   // locked in execution chain
            OrderStatus::OutForDelivery,     // locked in execution chain
            OrderStatus::Delivered,          // locked in execution chain
            OrderStatus::Returned,           // handled by Returns workflow
            OrderStatus::Cancelled,          // terminal
        ];

        if (in_array($ctx->order->status, $blocked, true)) {
            throw new WorkflowPreconditionException(
                "Order [{$ctx->order->id}] cannot be rescheduled from status [{$ctx->order->status->value}].",
            );
        }
    }

    public function execute(FulfillmentContext $ctx): FulfillmentResult
    {
        $order = $ctx->order;
        $reason = $ctx->get('reason');

        $order->update(['status' => OrderStatus::Scheduled]);
        $order->refresh();

        return FulfillmentResult::success(
            $order,
            "Order #{$order->order_number} marked as Rescheduled.",
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
        return 'mark_rescheduled';
    }
}
