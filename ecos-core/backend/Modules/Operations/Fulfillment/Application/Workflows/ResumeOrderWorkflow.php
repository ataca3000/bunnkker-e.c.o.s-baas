<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Workflows;

use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentContext;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentResult;
use Modules\Operations\Fulfillment\Domain\Contracts\FulfillmentWorkflowInterface;
use Modules\Operations\Fulfillment\Domain\Exceptions\WorkflowPreconditionException;

/**
 * Resumes an order from On Hold or Awaiting Stock back to In Progress.
 *
 * V3 (TASK-ORDERS-LIFECYCLE-ARCH-002): Rescheduled is removed; OnHold replaces Review.
 */
final class ResumeOrderWorkflow implements FulfillmentWorkflowInterface
{
    public function guard(FulfillmentContext $ctx): void
    {
        $allowed = [OrderStatus::OnHold, OrderStatus::AwaitingStock];

        if (! in_array($ctx->order->status, $allowed, true)) {
            throw new WorkflowPreconditionException(
                "Order [{$ctx->order->id}] can only be resumed from On Hold or Awaiting Stock. Current: [{$ctx->order->status->value}].",
            );
        }
    }

    public function execute(FulfillmentContext $ctx): FulfillmentResult
    {
        $order = $ctx->order;

        $order->update([
            'status'             => OrderStatus::InProgress,
            'rescheduled_at'     => null,
            'next_delivery_date' => null,
            'resume_from_status' => null,
            'reschedule_reason'  => null,
        ]);

        $order->refresh();

        return FulfillmentResult::success(
            $order,
            "Order #{$order->order_number} resumed to In Progress.",
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
        return 'resume_order';
    }
}
