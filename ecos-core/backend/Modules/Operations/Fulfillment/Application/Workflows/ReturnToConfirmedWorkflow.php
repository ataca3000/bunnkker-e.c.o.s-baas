<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Workflows;

use Modules\Commerce\Orders\Application\Actions\UpdateReservationStatusAction;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentContext;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentResult;
use Modules\Operations\Fulfillment\Domain\Contracts\FulfillmentWorkflowInterface;
use Modules\Operations\Fulfillment\Domain\Exceptions\WorkflowPreconditionException;

/**
 * Transitions a Returned order back to Confirmed status for re-delivery scheduling.
 *
 * Used when: customer wants the order re-delivered after an initial return,
 * or the return was logged in error and the order should continue normally.
 */
final class ReturnToConfirmedWorkflow implements FulfillmentWorkflowInterface
{
    public function __construct(
        private readonly UpdateReservationStatusAction $updateReservationStatus,
    ) {}

    public function guard(FulfillmentContext $ctx): void
    {
        if ($ctx->order->status !== OrderStatus::Returned) {
            throw new WorkflowPreconditionException(
                "Order [{$ctx->order->id}] must be in Returned status to return-to-confirmed. Current: [{$ctx->order->status->value}].",
            );
        }
    }

    public function execute(FulfillmentContext $ctx): FulfillmentResult
    {
        $order = $ctx->order;

        // BUG-004 fix: clear all inventory lifecycle timestamps so the Reservation
        // Engine can execute normally on re-entry. Without this reset,
        // ReserveOrderInventoryAction skips idempotently (Reserved / Released in
        // skipStates) and the order proceeds to Preparing with zero held stock.
        $order->update([
            'status' => OrderStatus::InProgress,
            'inventory_reserved_at' => null,
            'inventory_released_at' => null,
            'inventory_shipped_at' => null,
            'inventory_completed_at' => null,
        ]);

        // Clear reservation_status to null (structural reset — no audit entry needed).
        $this->updateReservationStatus->execute($order, null, null);

        $order->refresh();

        return FulfillmentResult::success(
            $order,
            "Order #{$order->order_number} returned to In Progress. Inventory lifecycle reset — reservation will be re-attempted.",
            ['actor_id' => $ctx->actorId, 'inventory_reset' => true],
        );
    }

    /** @return list<object> */
    public function events(FulfillmentResult $result): array
    {
        return [];
    }

    public function name(): string
    {
        return 'return_to_confirmed';
    }
}
