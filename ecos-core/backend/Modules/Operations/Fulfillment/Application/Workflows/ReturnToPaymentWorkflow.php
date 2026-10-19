<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Workflows;

use Modules\Commerce\Orders\Application\Actions\ReleaseOrderInventoryAction;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentContext;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentResult;
use Modules\Operations\Fulfillment\Domain\Contracts\FulfillmentWorkflowInterface;
use Modules\Operations\Fulfillment\Domain\Exceptions\WorkflowPreconditionException;

/**
 * V2: Returns an order to Payment (AwaitingPayment) status.
 *
 * When moving from Processing or Confirmed (reserved states), inventory is released
 * and products become editable again. When moving from other early states, only the
 * status is changed.
 */
final class ReturnToPaymentWorkflow implements FulfillmentWorkflowInterface
{
    public function __construct(
        private readonly ReleaseOrderInventoryAction $releaseInventory,
    ) {}

    public function guard(FulfillmentContext $ctx): void
    {
        $blocked = [
            OrderStatus::AwaitingPayment,    // already in this state
            OrderStatus::ReadyForDispatch,   // locked in execution chain
            OrderStatus::OutForDelivery,     // locked in execution chain
            OrderStatus::Delivered,          // locked in execution chain
            OrderStatus::Returned,           // handled by Returns workflow
            OrderStatus::Cancelled,          // terminal
        ];

        if (in_array($ctx->order->status, $blocked, true)) {
            throw new WorkflowPreconditionException(
                "Order [{$ctx->order->id}] cannot return to Payment from status [{$ctx->order->status->value}].",
            );
        }
    }

    public function execute(FulfillmentContext $ctx): FulfillmentResult
    {
        $order = $ctx->order;
        $released = false;

        // Release inventory when returning to a product-editable state from a reserved state
        if ($order->assigned_warehouse_id !== null
            && $order->inventory_reserved_at !== null
            && $order->inventory_released_at === null
        ) {
            $this->releaseInventory->execute($order);
            $released = true;
        }

        $order->update([
            'status' => OrderStatus::AwaitingPayment,
            'inventory_reserved_at' => $released ? null : $order->inventory_reserved_at,
            'inventory_released_at' => null,
        ]);
        $order->refresh();

        return FulfillmentResult::success(
            $order,
            "Order #{$order->order_number} returned to Payment.".($released ? ' Inventory reservation released.' : ''),
            [
                'inventory_released' => $released,
                'actor_id' => $ctx->actorId,
            ],
        );
    }

    /** @return list<object> */
    public function events(FulfillmentResult $result): array
    {
        return [];
    }

    public function name(): string
    {
        return 'return_to_payment';
    }
}
