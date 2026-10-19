<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Workflows;

use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentContext;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentResult;
use Modules\Operations\Fulfillment\Domain\Contracts\FulfillmentWorkflowInterface;
use Modules\Operations\Fulfillment\Domain\Exceptions\WorkflowPreconditionException;

/**
 * Transitions a Delivered order back to Confirmed status.
 *
 * Used when: a delivery was marked as complete in error (e.g. driver mis-scanned),
 * and the order needs to be re-confirmed for another delivery attempt.
 */
final class ResumeToConfirmedWorkflow implements FulfillmentWorkflowInterface
{
    public function guard(FulfillmentContext $ctx): void
    {
        $order = $ctx->order;

        if ($order->status !== OrderStatus::Delivered) {
            throw new WorkflowPreconditionException(
                "Order [{$order->id}] must be in Delivered status to resume-to-confirmed. Current: [{$order->status->value}].",
            );
        }

        // C-1 fix: block when inventory has been physically shipped and FIFO layers consumed.
        // Clearing inventory_shipped_at without restoring stock would allow ShipOrderInventoryAction
        // to execute again — decrementing on_hand_qty and consuming layers a second time.
        // For true resume (mis-scan recovery), use ReturnOrderWorkflow first to restore stock,
        // then re-confirm through the normal Confirmed workflow.
        if ($order->inventory_shipped_at !== null) {
            throw new WorkflowPreconditionException(
                "Order [{$order->id}] has inventory already shipped (inventory_shipped_at is set). ".
                'Use ReturnOrderWorkflow first to restore inventory before re-confirming.',
            );
        }
    }

    public function execute(FulfillmentContext $ctx): FulfillmentResult
    {
        $order = $ctx->order;

        // Reset lifecycle fields so the order can re-enter the reservation cycle.
        // Guard above ensures inventory_shipped_at is null (stock was not yet consumed).
        $order->update([
            'status' => OrderStatus::InProgress,
            'inventory_reserved_at' => null,
            'inventory_released_at' => null,
            'inventory_shipped_at' => null,
            'inventory_completed_at' => null,
            'reservation_status' => null,
            'reservation_failure_reason' => null,
            'partial_reservation_approved_at' => null,  // H-4: stale approval must be re-granted
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
        return 'resume_to_confirmed';
    }
}
