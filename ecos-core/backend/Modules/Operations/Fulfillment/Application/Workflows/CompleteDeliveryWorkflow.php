<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Workflows;

use Modules\Commerce\Orders\Application\Actions\UpdateReservationStatusAction;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Enums\ReservationStatus;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentContext;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentResult;
use Modules\Operations\Fulfillment\Domain\Contracts\FulfillmentWorkflowInterface;
use Modules\Operations\Fulfillment\Domain\Events\OrderDeliveredEvent;
use Modules\Operations\Fulfillment\Domain\Exceptions\WorkflowPreconditionException;

/**
 * Records customer delivery: out_for_delivery → delivered.
 *
 * Inventory was already deducted by LoadVehicleWorkflow.
 * Revenue recognition happens at this stage.
 * Use CompleteOrderWorkflow to advance delivered → completed.
 */
final class CompleteDeliveryWorkflow implements FulfillmentWorkflowInterface
{
    public function __construct(
        private readonly UpdateReservationStatusAction $updateReservationStatus,
    ) {}

    public function guard(FulfillmentContext $ctx): void
    {
        $order = $ctx->order;

        if ($order->status !== OrderStatus::OutForDelivery) {
            throw new WorkflowPreconditionException(
                "Order [{$order->id}] cannot be delivered from status [{$order->status->value}]. Must be out_for_delivery.",
            );
        }

        if ($order->inventory_shipped_at === null) {
            throw new WorkflowPreconditionException(
                "Order [{$order->id}] cannot be delivered: inventory has not been dispatched.",
            );
        }
    }

    public function execute(FulfillmentContext $ctx): FulfillmentResult
    {
        $order = $ctx->order;

        $order->update(['status' => OrderStatus::Delivered]);
        $order->refresh();

        $this->updateReservationStatus->execute(
            $order,
            ReservationStatus::Consumed,
            'Delivered to customer',
        );

        return FulfillmentResult::success(
            $order,
            "Order #{$order->order_number} delivered to customer.",
            [
                'revenue' => $order->total,
                'cogs_amount' => $order->actual_cogs_amount,
                'margin_amount' => $order->actual_margin_amount,
                'margin_percent' => $order->actual_margin_percent,
                'actor_id' => $ctx->actorId,
            ],
        );
    }

    /** @return list<object> */
    public function events(FulfillmentResult $result): array
    {
        $order = $result->order;
        $meta = $result->meta;

        return [
            new OrderDeliveredEvent(
                orderId: $order->id,
                orderNumber: $order->order_number,
                companyId: $order->company_id ?? '',
                revenue: (float) ($meta['revenue'] ?? 0),
                cogsAmount: (float) ($meta['cogs_amount'] ?? 0),
                marginAmount: (float) ($meta['margin_amount'] ?? 0),
                marginPercent: (float) ($meta['margin_percent'] ?? 0),
                deliveredAt: now()->toIso8601String(),
                actorId: $meta['actor_id'] ?? null,
            ),
        ];
    }

    public function name(): string
    {
        return 'complete_delivery';
    }
}
