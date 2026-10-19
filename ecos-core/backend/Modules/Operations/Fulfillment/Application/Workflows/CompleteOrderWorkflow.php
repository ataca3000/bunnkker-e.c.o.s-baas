<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Workflows;

use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentContext;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentResult;
use Modules\Operations\Fulfillment\Domain\Contracts\FulfillmentWorkflowInterface;
use Modules\Operations\Fulfillment\Domain\Events\OrderCompletedEvent;
use Modules\Operations\Fulfillment\Domain\Exceptions\WorkflowPreconditionException;

/**
 * Financially completes an order: delivered → completed.
 *
 * Triggered once accounting review, return window, and settlement are done.
 * Order becomes permanently closed.
 */
final class CompleteOrderWorkflow implements FulfillmentWorkflowInterface
{
    public function guard(FulfillmentContext $ctx): void
    {
        $order = $ctx->order;

        if ($order->status !== OrderStatus::Delivered) {
            throw new WorkflowPreconditionException(
                "Order [{$order->id}] must be in delivered status before completion. Current: [{$order->status->value}].",
            );
        }
    }

    public function execute(FulfillmentContext $ctx): FulfillmentResult
    {
        $order = $ctx->order;

        $order->update(['status' => OrderStatus::Delivered]);
        $order->refresh();

        return FulfillmentResult::success(
            $order,
            "Order #{$order->order_number} completed and permanently closed.",
            [
                'revenue' => (float) ($order->total ?? 0),
                'cogs_amount' => (float) ($order->actual_cogs_amount ?? 0),
                'margin_amount' => (float) ($order->actual_margin_amount ?? 0),
                'margin_percent' => $order->actual_margin_percent !== null ? (float) $order->actual_margin_percent : null,
                'completed_at' => now()->toIso8601String(),
                'actor_id' => $ctx->actorId,
            ],
        );
    }

    /** @return list<object> */
    public function events(FulfillmentResult $result): array
    {
        $order = $result->order;

        return [
            new OrderCompletedEvent(
                orderId: $order->id,
                orderNumber: $order->order_number,
                companyId: $order->company_id ?? '',
                revenue: (float) ($result->meta['revenue'] ?? 0),
                cogsAmount: (float) ($result->meta['cogs_amount'] ?? 0),
                marginAmount: (float) ($result->meta['margin_amount'] ?? 0),
                marginPercent: $result->meta['margin_percent'] !== null ? (float) $result->meta['margin_percent'] : null,
                completedAt: $result->meta['completed_at'] ?? now()->toIso8601String(),
                actorId: $result->meta['actor_id'] ?? null,
            ),
        ];
    }

    public function name(): string
    {
        return 'complete_order';
    }
}
