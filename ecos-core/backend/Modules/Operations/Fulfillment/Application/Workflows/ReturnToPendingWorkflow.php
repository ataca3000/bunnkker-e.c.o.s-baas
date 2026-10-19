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
 * Returns an order to New status, releasing inventory reservation.
 *
 * V3 (TASK-ORDERS-LIFECYCLE-ARCH-002): "Pending" renamed to "New". This workflow
 * releases the order for structural edits (product changes, address, customer).
 * Only valid from pre-execution states — ReadyForDispatch and beyond are locked.
 */
final class ReturnToPendingWorkflow implements FulfillmentWorkflowInterface
{
    public function __construct(
        private readonly ReleaseOrderInventoryAction $releaseInventory,
    ) {}

    public function guard(FulfillmentContext $ctx): void
    {
        $allowed = [
            OrderStatus::AwaitingPayment,
            OrderStatus::InProgress,
            OrderStatus::AwaitingStock,
            OrderStatus::OnHold,
            OrderStatus::Cancelled,
            OrderStatus::Scheduled,
        ];

        if (! in_array($ctx->order->status, $allowed, true)) {
            throw new WorkflowPreconditionException(
                "Order [{$ctx->order->id}] cannot return to New from status [{$ctx->order->status->value}].",
            );
        }
    }

    public function execute(FulfillmentContext $ctx): FulfillmentResult
    {
        $order = $ctx->order;
        $released = false;

        if ($order->assigned_warehouse_id !== null && $order->inventory_released_at === null && $order->inventory_reserved_at !== null) {
            $this->releaseInventory->execute($order);
            $released = true;
        }

        // DRIFT-009 fix: clear reservation_status so it does not stay stale as 'Released'.
        // H-4 fix: also clear partial_reservation_approved_at — shortage profile may change.
        $order->update([
            'status'                         => OrderStatus::NewOrder,
            'inventory_reserved_at'          => null,
            'inventory_released_at'          => null,
            'reservation_status'             => null,
            'reservation_failure_reason'     => null,
            'partial_reservation_approved_at' => null,
        ]);
        $order->refresh();

        return FulfillmentResult::success(
            $order,
            "Order #{$order->order_number} returned to New.".($released ? ' Inventory reservation released.' : ''),
            [
                'inventory_released' => $released,
                'actor_id'           => $ctx->actorId,
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
        return 'return_to_new';
    }
}
