<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Workflows;

use Modules\Commerce\Orders\Application\Actions\ReserveOrderInventoryAction;
use Modules\Commerce\Orders\Application\Actions\UpdateReservationStatusAction;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Enums\ReservationStatus;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Orders\Domain\Models\OrderEvent;
use Modules\Commerce\Orders\Domain\Models\OrderReservationAudit;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentContext;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentResult;
use Modules\Operations\Fulfillment\Domain\Contracts\FulfillmentWorkflowInterface;
use Modules\Operations\Fulfillment\Domain\Events\InterWarehouseTransferRequestedEvent;
use Modules\Operations\Fulfillment\Domain\Exceptions\WorkflowPreconditionException;

/**
 * Initiates an order: reserves inventory and moves to In Progress.
 *
 * V3 (TASK-ORDERS-LIFECYCLE-ARCH-002): Replaces both ProcessOrderWorkflow and
 * ConfirmOrderWorkflow. All new orders auto-trigger this workflow on creation.
 *
 * Inventory Reservation Contract:
 * - Reservation is ALWAYS attempted when entering In Progress.
 * - No warehouse → routed to AwaitingStock.
 * - Insufficient stock → routed to AwaitingStock.
 * - Idempotent: existing reservation is preserved and not duplicated.
 */
final class ProcessOrderWorkflow implements FulfillmentWorkflowInterface
{
    public function __construct(
        private readonly ReserveOrderInventoryAction $reserveInventory,
        private readonly UpdateReservationStatusAction $updateReservationStatus,
    ) {}

    public function guard(FulfillmentContext $ctx): void
    {
        $order = $ctx->order;

        $allowed = [
            OrderStatus::NewOrder,
            OrderStatus::AwaitingPayment,
            OrderStatus::AwaitingStock,
            OrderStatus::Scheduled,
            OrderStatus::OnHold,
            OrderStatus::Cancelled,
            // InProgress allowed for idempotent re-initiation (e.g. after partial reservation approval)
            OrderStatus::InProgress,
        ];

        if (! in_array($order->status, $allowed, true)) {
            throw new WorkflowPreconditionException(
                "Order [{$order->id}] cannot be initiated from status [{$order->status->value}].",
            );
        }

        // Scheduled orders must not enter the operational queue before their delivery date.
        // Allow bypass only when the actor explicitly overrides or today >= requested_delivery_date.
        if ($order->status === OrderStatus::Scheduled) {
            $deliveryDate = (string) ($order->requested_delivery_date ?? '');
            $today = now()->toDateString();
            $forceActivate = (bool) ($ctx->get('force_activate') ?? false);

            if ($deliveryDate !== '' && $deliveryDate > $today && ! $forceActivate) {
                throw new WorkflowPreconditionException(
                    "Order [{$order->id}] is Scheduled for [{$deliveryDate}] and cannot enter the operational queue before its delivery date. Pass force_activate=true to override.",
                );
            }
        }
    }

    public function execute(FulfillmentContext $ctx): FulfillmentResult
    {
        $order = $ctx->order;

        // Clear on_hold / cancel metadata on re-activation
        if (in_array($order->status, [OrderStatus::OnHold, OrderStatus::Cancelled], true)) {
            $order->update([
                'rescheduled_at'     => null,
                'next_delivery_date' => null,
                'resume_from_status' => null,
                'reschedule_reason'  => null,
            ]);
            $order->refresh();
        }

        // Idempotent: inventory already held — go straight to InProgress
        $activeStates    = [ReservationStatus::Reserved, ReservationStatus::PartialReserved];
        $alreadyReserved = in_array($order->reservation_status, $activeStates, true);

        if (! $alreadyReserved) {
            // No warehouse assigned → route to AwaitingStock
            if ($order->assigned_warehouse_id === null) {
                $order->update(['status' => OrderStatus::AwaitingStock]);
                $order->refresh();

                $this->updateReservationStatus->execute(
                    $order,
                    ReservationStatus::AwaitingStock,
                    'Warehouse Not Assigned',
                );

                OrderEvent::log(
                    orderId: $order->id,
                    type: 'reservation_awaiting_stock',
                    description: "Reservation pending for order #{$order->order_number}: no warehouse assigned.",
                    payload: ['reason' => 'no_warehouse_assigned'],
                    module: 'fulfillment',
                );

                return FulfillmentResult::success(
                    $order,
                    "Order #{$order->order_number} awaiting stock — no warehouse assigned.",
                    ['actor_id' => $ctx->actorId, 'reservation_failed' => true],
                );
            }

            // Attempt reservation — does NOT throw for insufficient stock
            $reservationStatus = $this->reserveInventory->execute($order);
            $order->refresh();

            if ($reservationStatus === ReservationStatus::AwaitingStock) {
                $order->update(['status' => OrderStatus::AwaitingStock]);
                $order->refresh();

                $transferShortageLines = $this->resolveInterWarehouseShortage($order);

                return FulfillmentResult::success(
                    $order,
                    "Order #{$order->order_number} awaiting stock — insufficient inventory.",
                    [
                        'actor_id'               => $ctx->actorId,
                        'reservation_failed'     => true,
                        'transfer_requested'     => $transferShortageLines !== null,
                        'transfer_shortage_lines' => $transferShortageLines,
                        'transfer_requested_at'  => $transferShortageLines !== null ? now()->toIso8601String() : null,
                    ],
                );
            }
        }

        $order->update(['status' => OrderStatus::InProgress]);
        $order->refresh();

        return FulfillmentResult::success(
            $order,
            $alreadyReserved
                ? "Order #{$order->order_number} moved to In Progress."
                : "Order #{$order->order_number} moved to In Progress. Inventory reserved.",
            ['actor_id' => $ctx->actorId],
        );
    }

    /** @return list<object> */
    public function events(FulfillmentResult $result): array
    {
        if (! ($result->meta['transfer_requested'] ?? false)) {
            return [];
        }

        $order = $result->order;

        return [
            new InterWarehouseTransferRequestedEvent(
                orderId: $order->id,
                orderNumber: $order->order_number,
                companyId: $order->company_id ?? '',
                assignedWarehouseId: $order->assigned_warehouse_id ?? '',
                shortageLines: $result->meta['transfer_shortage_lines'] ?? [],
                requestedAt: $result->meta['transfer_requested_at'] ?? now()->toIso8601String(),
                actorId: $result->meta['actor_id'] ?? null,
            ),
        ];
    }

    public function name(): string
    {
        return 'initiate_order';
    }

    /**
     * P1-005 — Query other warehouses for shortage products.
     *
     * @return list<array{product_id: string, sku: string|null, required_qty: float, available_warehouses: list<array{warehouse_id: string, available_qty: float}>}>|null
     */
    private function resolveInterWarehouseShortage(Order $order): ?array
    {
        if ($order->assigned_warehouse_id === null) {
            return null;
        }

        $audit = OrderReservationAudit::where('order_id', $order->id)
            ->where('to_status', ReservationStatus::AwaitingStock->value)
            ->latest('created_at')
            ->first();

        if ($audit === null) {
            return null;
        }

        $auditLines = $audit->meta['lines'] ?? [];
        $shortageProductIds = collect($auditLines)
            ->filter(fn ($l) => in_array($l['outcome'], ['none', 'partial'], true))
            ->pluck('product_id')
            ->unique()
            ->values()
            ->all();

        if (empty($shortageProductIds)) {
            return null;
        }

        $alternativeItems = InventoryItem::whereIn('product_id', $shortageProductIds)
            ->where('warehouse_id', '!=', $order->assigned_warehouse_id)
            ->whereRaw('(on_hand_qty - reserved_qty) > 0')
            ->get(['product_id', 'warehouse_id', 'on_hand_qty', 'reserved_qty'])
            ->groupBy('product_id');

        if ($alternativeItems->isEmpty()) {
            return null;
        }

        $shortageLines = [];

        foreach ($auditLines as $line) {
            if (! in_array($line['outcome'], ['none', 'partial'], true)) {
                continue;
            }

            $productId   = $line['product_id'];
            $requiredQty = (float) $line['requested'] - (float) ($line['reserved'] ?? 0);
            $alternatives = $alternativeItems->get($productId, collect());

            if ($alternatives->isEmpty()) {
                continue;
            }

            $shortageLines[] = [
                'product_id'          => $productId,
                'sku'                 => null,
                'required_qty'        => $requiredQty,
                'available_warehouses' => $alternatives
                    ->map(fn ($item) => [
                        'warehouse_id'  => $item->warehouse_id,
                        'available_qty' => max(0.0, (float) $item->on_hand_qty - (float) $item->reserved_qty),
                    ])
                    ->values()
                    ->all(),
            ];
        }

        return empty($shortageLines) ? null : $shortageLines;
    }
}
