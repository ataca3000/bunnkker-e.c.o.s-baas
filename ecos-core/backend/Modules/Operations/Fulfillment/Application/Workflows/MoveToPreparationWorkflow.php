<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Workflows;

use Modules\Commerce\Orders\Application\Actions\ReserveOrderInventoryAction;
use Modules\Commerce\Orders\Application\Actions\UpdateReservationStatusAction;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Enums\ReservationStatus;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentContext;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentResult;
use Modules\Operations\Fulfillment\Domain\Contracts\FulfillmentWorkflowInterface;
use Modules\Operations\Fulfillment\Domain\Events\OrderPreparationStartedEvent;
use Modules\Operations\Fulfillment\Domain\Exceptions\WorkflowPreconditionException;

/**
 * Marks an order as Ready for Dispatch — all engines have completed.
 *
 * V3 (TASK-ORDERS-LIFECYCLE-ARCH-002): Previously moved order to Preparing status.
 * In V3, Preparing is an invisible engine state — orders stay In Progress while being
 * prepared. This workflow is called by the Preparation OS when all work is done,
 * transitioning the order to Ready for Dispatch so it can be dispatched.
 *
 * Automatic Reservation Guard (ADR-015 / Phase 8):
 * If a reservation is missing, one is created on-the-fly before the status transition.
 */
final class MoveToPreparationWorkflow implements FulfillmentWorkflowInterface
{
    public function __construct(
        private readonly ReserveOrderInventoryAction $reserveInventory,
        private readonly UpdateReservationStatusAction $updateReservationStatus,
    ) {}

    public function guard(FulfillmentContext $ctx): void
    {
        $order = $ctx->order;

        if ($order->status !== OrderStatus::InProgress) {
            throw new WorkflowPreconditionException(
                "Order [{$order->id}] must be In Progress to become Ready for Dispatch. Current: [{$order->status->value}].",
            );
        }

        // Block terminal reservation states: Released/Consumed/Transferred mean the inventory
        // commitment has ended. H-2 fix: prevents entering dispatch with zero stock.
        $terminalReservationStates = [
            ReservationStatus::Released,
            ReservationStatus::Consumed,
            ReservationStatus::Transferred,
        ];
        if (in_array($order->reservation_status, $terminalReservationStates, true)) {
            throw new WorkflowPreconditionException(
                "Order [{$order->id}] has reservation_status [{$order->reservation_status?->value}] and cannot become Ready for Dispatch. ".
                'Release and re-reserve inventory before moving to dispatch.',
            );
        }

        // PartialReserved orders require explicit manager approval before dispatch.
        if ($order->reservation_status === ReservationStatus::PartialReserved
            && $order->partial_reservation_approved_at === null
        ) {
            throw new WorkflowPreconditionException(
                "Order [{$order->id}] has a partial reservation and requires manager approval before dispatch. ".
                'Use the approve-partial-reservation endpoint to grant approval.',
            );
        }
    }

    public function execute(FulfillmentContext $ctx): FulfillmentResult
    {
        $order = $ctx->order;
        $reservationCreated = false;

        // Automatic Reservation Guard — create reservation on-the-fly when not yet reserved.
        $activeStates = [ReservationStatus::Reserved, ReservationStatus::PartialReserved];
        if (! in_array($order->reservation_status, $activeStates, true)) {
            $reservationResult = $this->reserveInventory->execute($order);
            $order->refresh();
            $reservationCreated = true;

            if ($reservationResult === ReservationStatus::AwaitingStock) {
                $order->update(['status' => OrderStatus::AwaitingStock]);
                $order->refresh();

                return FulfillmentResult::success(
                    $order,
                    "Order #{$order->order_number} cannot become Ready for Dispatch — insufficient stock. Moved to Awaiting Stock.",
                    [
                        'actor_id'            => $ctx->actorId,
                        'reservation_created' => true,
                        'reservation_status'  => $order->reservation_status?->value,
                        'started_at'          => now()->toIso8601String(),
                    ],
                );
            }
        }

        $order->update(['status' => OrderStatus::ReadyForDispatch]);
        $order->refresh();

        $message = "Order #{$order->order_number} is Ready for Dispatch.";
        if ($reservationCreated) {
            $message .= ' Inventory reserved automatically.';
        }

        return FulfillmentResult::success(
            $order,
            $message,
            [
                'actor_id'            => $ctx->actorId,
                'reservation_created' => $reservationCreated,
                'warehouse_id'        => $order->assigned_warehouse_id,
                'reservation_status'  => $order->reservation_status?->value,
                'started_at'          => now()->toIso8601String(),
            ],
        );
    }

    /** @return list<object> */
    public function events(FulfillmentResult $result): array
    {
        $order = $result->order;

        if ($order->status !== OrderStatus::ReadyForDispatch) {
            return [];
        }

        return [
            new OrderPreparationStartedEvent(
                orderId: $order->id,
                orderNumber: $order->order_number,
                companyId: $order->company_id ?? '',
                warehouseId: $order->assigned_warehouse_id ?? '',
                // handle() already publishes this into meta alongside actor_id and
                // started_at. It was populated but never read, so the constructor
                // received six of its seven required arguments and always threw.
                reservationStatus: $result->meta['reservation_status'] ?? '',
                actorId: $result->meta['actor_id'] ?? null,
                startedAt: $result->meta['started_at'] ?? now()->toIso8601String(),
            ),
        ];
    }

    public function name(): string
    {
        return 'ready_for_dispatch';
    }
}
