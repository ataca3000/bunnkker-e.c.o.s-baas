<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Workflows;

use Illuminate\Support\Facades\DB;
use Modules\Commerce\Orders\Application\Actions\ShipOrderInventoryAction;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentContext;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentResult;
use Modules\Operations\Fulfillment\Domain\Contracts\FulfillmentWorkflowInterface;
use Modules\Operations\Fulfillment\Domain\Events\OrderDispatchedEvent;
use Modules\Operations\Fulfillment\Domain\Exceptions\WorkflowPreconditionException;

/**
 * Direct dispatch: preparing → out_for_delivery (simple path, no loading OS).
 *
 * ShipOrderInventoryAction is called first so that inventory is decremented,
 * reserved stock is released, FIFO consumption runs, and actual COGS is stamped
 * before the status transition commits. If shipment fails the status remains
 * Preparing and the transaction rolls back atomically.
 */
final class DispatchOrderWorkflow implements FulfillmentWorkflowInterface
{
    public function __construct(
        private readonly ShipOrderInventoryAction $shipInventory,
    ) {}

    public function guard(FulfillmentContext $ctx): void
    {
        if ($ctx->order->status !== OrderStatus::ReadyForDispatch) {
            throw new WorkflowPreconditionException(
                "Order [{$ctx->order->id}] can only be dispatched from Ready for Dispatch. Current: [{$ctx->order->status->value}].",
            );
        }
    }

    public function execute(FulfillmentContext $ctx): FulfillmentResult
    {
        $order = $ctx->order;

        // Ship inventory and transition status atomically.
        // ShipOrderInventoryAction opens its own savepoint inside this transaction.
        // If shipment fails (no warehouse, no reservation, insufficient reserved qty),
        // the exception propagates and the status update never executes.
        DB::transaction(function () use ($order): void {
            $this->shipInventory->execute($order);

            $order->update(['status' => OrderStatus::OutForDelivery]);
        });

        $order->refresh();

        return FulfillmentResult::success(
            $order,
            "Order #{$order->order_number} dispatched for delivery.",
            [
                'actor_id' => $ctx->actorId,
                'dispatched_at' => now()->toIso8601String(),
            ],
        );
    }

    /** @return list<object> */
    public function events(FulfillmentResult $result): array
    {
        $order = $result->order;

        return [
            new OrderDispatchedEvent(
                orderId: $order->id,
                orderNumber: $order->order_number,
                companyId: $order->company_id ?? '',
                vehicleAssignmentId: null,
                vehicleId: null,
                driverId: null,
                cogsAmount: (float) ($order->actual_cogs_amount ?? 0),
                dispatchedAt: $result->meta['dispatched_at'] ?? now()->toIso8601String(),
                actorId: $result->meta['actor_id'] ?? null,
            ),
        ];
    }

    public function name(): string
    {
        return 'dispatch_order';
    }
}
