<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Workflows;

use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Enums\ReservationStatus;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentContext;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentResult;
use Modules\Operations\Fulfillment\Domain\Contracts\FulfillmentWorkflowInterface;
use Modules\Operations\Fulfillment\Domain\Events\PartialReservationApprovedEvent;
use Modules\Operations\Fulfillment\Domain\Exceptions\WorkflowPreconditionException;

/**
 * P1-002 — Manager approval gate for PartialReserved → Preparing.
 *
 * A PartialReserved order signals that some line items do not have sufficient
 * stock. Before operations can begin preparing the order, a manager must
 * explicitly approve proceeding with the partial reservation. This prevents
 * silently packing partial orders without business awareness of the shortage.
 *
 * After approval is granted, MoveToPreparationWorkflow's guard() will allow
 * the order to enter preparation.
 *
 * Context keys:
 *   notes  (optional, string) — manager's approval rationale for the audit trail
 */
final class ApprovePartialReservationWorkflow implements FulfillmentWorkflowInterface
{
    public function guard(FulfillmentContext $ctx): void
    {
        $order = $ctx->order;

        if ($order->reservation_status !== ReservationStatus::PartialReserved) {
            throw new WorkflowPreconditionException(
                "Order [{$order->id}] is not in PartialReserved state (current: [{$order->reservation_status?->value}]). Only partially-reserved orders require this approval.",
            );
        }

        $approvableStatuses = [OrderStatus::InProgress, OrderStatus::AwaitingStock, OrderStatus::NewOrder];
        if (! in_array($order->status, $approvableStatuses, true)) {
            throw new WorkflowPreconditionException(
                "Order [{$order->id}] cannot receive partial-reservation approval from status [{$order->status->value}].",
            );
        }

        if ($order->partial_reservation_approved_at !== null) {
            throw new WorkflowPreconditionException(
                "Order [{$order->id}] has already been approved for partial reservation on [{$order->partial_reservation_approved_at}].",
            );
        }
    }

    public function execute(FulfillmentContext $ctx): FulfillmentResult
    {
        $order = $ctx->order;
        $notes = $ctx->get('notes');

        $order->update([
            'partial_reservation_approved_at' => now(),
            'partial_reservation_approved_by' => $ctx->actorId,
            'partial_reservation_approval_notes' => $notes,
        ]);

        $order->refresh();

        return FulfillmentResult::success(
            $order,
            "Partial reservation approved for order #{$order->order_number}. Order may now proceed to preparation.",
            [
                'approved_by' => $ctx->actorId,
                'approved_at' => $order->partial_reservation_approved_at?->toIso8601String(),
                'notes' => $notes,
            ],
        );
    }

    /** @return list<object> */
    public function events(FulfillmentResult $result): array
    {
        $order = $result->order;

        return [
            new PartialReservationApprovedEvent(
                orderId: $order->id,
                orderNumber: $order->order_number,
                companyId: $order->company_id ?? '',
                approvedAt: $result->meta['approved_at'] ?? now()->toIso8601String(),
                approvedBy: $result->meta['approved_by'] ?? null,
                notes: $result->meta['notes'] ?? null,
            ),
        ];
    }

    public function name(): string
    {
        return 'approve_partial_reservation';
    }
}
