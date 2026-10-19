<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Workflows;

use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentContext;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentResult;
use Modules\Operations\Fulfillment\Domain\Contracts\FulfillmentWorkflowInterface;
use Modules\Operations\Fulfillment\Domain\Exceptions\WorkflowPreconditionException;

/**
 * Returns a Processing / AwaitingStock / Review order back to Confirmed.
 *
 * Used when: the order was moved out of Confirmed prematurely and no
 * preparation work has started. Inventory reservation is preserved; only
 * the status is rolled back.
 */
final class RevertToConfirmedWorkflow implements FulfillmentWorkflowInterface
{
    public function guard(FulfillmentContext $ctx): void
    {
        $allowed = [
            OrderStatus::InProgress,
            OrderStatus::AwaitingStock,
            OrderStatus::OnHold,
        ];

        if (! in_array($ctx->order->status, $allowed, true)) {
            throw new WorkflowPreconditionException(
                "Order [{$ctx->order->id}] must be in InProgress, AwaitingStock, or OnHold to revert. Current: [{$ctx->order->status->value}].",
            );
        }
    }

    public function execute(FulfillmentContext $ctx): FulfillmentResult
    {
        $order = $ctx->order;

        $order->update(['status' => OrderStatus::InProgress]);
        $order->refresh();

        return FulfillmentResult::success(
            $order,
            "Order #{$order->order_number} reverted to In Progress.",
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
        return 'revert_to_confirmed';
    }
}
