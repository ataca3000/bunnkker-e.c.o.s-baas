<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Workflows;

use InvalidArgumentException;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentContext;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentResult;
use Modules\Operations\Fulfillment\Domain\Contracts\FulfillmentWorkflowInterface;
use Modules\Operations\Fulfillment\Domain\Exceptions\WorkflowPreconditionException;

/**
 * Generic no-inventory status setter for simple V3 transitions.
 *
 * Used for status changes that require no inventory action:
 *   - Any pre-dispatch state → On Hold / Awaiting Payment / Scheduled
 *   - Reads `target_status` from context data.
 */
final class SetEarlyStatusWorkflow implements FulfillmentWorkflowInterface
{
    public function guard(FulfillmentContext $ctx): void
    {
        $executionLocked = [
            OrderStatus::ReadyForDispatch,
            OrderStatus::OutForDelivery,
            OrderStatus::Delivered,
            OrderStatus::Returned,
        ];

        if (in_array($ctx->order->status, $executionLocked, true)) {
            throw new WorkflowPreconditionException(
                "Order [{$ctx->order->id}] is in state [{$ctx->order->status->value}] and cannot use SetEarlyStatusWorkflow.",
            );
        }

        $target = $ctx->get('target_status');
        if (! $target || ! OrderStatus::tryFrom((string) $target)) {
            throw new InvalidArgumentException(
                "SetEarlyStatusWorkflow requires a valid 'target_status' in context data.",
            );
        }
    }

    public function execute(FulfillmentContext $ctx): FulfillmentResult
    {
        $order = $ctx->order;
        $targetStatus = OrderStatus::from((string) $ctx->require('target_status'));

        $order->update(['status' => $targetStatus]);
        $order->refresh();

        return FulfillmentResult::success(
            $order,
            "Order #{$order->order_number} moved to {$targetStatus->label()}.",
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
        return 'set_early_status';
    }
}
