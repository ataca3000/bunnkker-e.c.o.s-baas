<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Workflows;

use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Models\OrderEvent;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentContext;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentResult;
use Modules\Operations\Fulfillment\Domain\Contracts\FulfillmentWorkflowInterface;
use Modules\Operations\Fulfillment\Domain\Exceptions\WorkflowPreconditionException;

/**
 * Returns a Ready for Dispatch order back to In Progress.
 *
 * V3 (TASK-ORDERS-LIFECYCLE-ARCH-002): was Preparing → Processing; now ReadyForDispatch → InProgress.
 * Used when preparation was marked ready in error and must be re-queued.
 */
final class ReturnToProcessingWorkflow implements FulfillmentWorkflowInterface
{
    public function guard(FulfillmentContext $ctx): void
    {
        if ($ctx->order->status !== OrderStatus::ReadyForDispatch) {
            throw new WorkflowPreconditionException(
                "Order [{$ctx->order->id}] must be Ready for Dispatch to return to In Progress. Current: [{$ctx->order->status->value}].",
            );
        }
    }

    public function execute(FulfillmentContext $ctx): FulfillmentResult
    {
        $order = $ctx->order;

        $order->update(['status' => OrderStatus::InProgress]);
        $order->refresh();

        OrderEvent::log(
            orderId: $order->id,
            type: 'returned_to_in_progress',
            description: "Order #{$order->order_number} returned from Ready for Dispatch to In Progress".
                          ($ctx->get('reason') ? ': '.$ctx->get('reason') : '.'),
            payload: ['actor_id' => $ctx->actorId],
            module: 'fulfillment',
        );

        return FulfillmentResult::success(
            $order,
            "Order #{$order->order_number} returned to In Progress.",
            ['actor_id' => $ctx->actorId],
        );
    }

    /** @return list<object> */
    public function events(FulfillmentResult $result): array
    {
        return [];
    }

    public function name(): string
    {
        return 'return_to_processing';
    }
}
