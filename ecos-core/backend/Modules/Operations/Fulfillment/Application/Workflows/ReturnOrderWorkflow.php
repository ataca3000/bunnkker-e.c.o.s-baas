<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Workflows;

use Illuminate\Support\Str;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentContext;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentResult;
use Modules\Operations\Fulfillment\Domain\Contracts\FulfillmentWorkflowInterface;
use Modules\Operations\Fulfillment\Domain\Events\OrderReturnedEvent;
use Modules\Operations\Fulfillment\Domain\Exceptions\WorkflowPreconditionException;
use Modules\Operations\Fulfillment\Domain\Models\CustomerReturn;
use Modules\Operations\Fulfillment\Domain\Models\CustomerReturnLine;

/**
 * Records a driver-reported delivery rejection.
 *
 * Creates a CustomerReturn with status pending_inspection so the warehouse
 * can accept or reject the returned goods. Closes GAP-05 (driver leg).
 *
 * Inventory is NOT restored here — restoration happens in ReceiveReturnWorkflow
 * after warehouse inspection confirms condition.
 */
final class ReturnOrderWorkflow implements FulfillmentWorkflowInterface
{
    public function guard(FulfillmentContext $ctx): void
    {
        $order = $ctx->order;

        // ReadyForLoading was removed in V2 (loading is handled by LoadVehicleWorkflow).
        // Returns are only accepted when the order is actively out for delivery.
        $allowed = [OrderStatus::OutForDelivery];

        if (! in_array($order->status, $allowed, true)) {
            throw new WorkflowPreconditionException(
                "Order [{$order->id}] cannot be returned from status [{$order->status->value}].",
            );
        }

        if (empty($ctx->get('return_reason'))) {
            throw new WorkflowPreconditionException(
                "Order [{$order->id}] return requires a reason.",
            );
        }

        if (empty($ctx->get('lines'))) {
            throw new WorkflowPreconditionException(
                "Order [{$order->id}] return requires at least one returned line.",
            );
        }
    }

    public function execute(FulfillmentContext $ctx): FulfillmentResult
    {
        $order = $ctx->order;
        $reason = (string) $ctx->require('return_reason');
        $lines = (array) $ctx->require('lines');

        $order->loadMissing('lines');

        $orderLinesById = $order->lines->keyBy('id');

        $returnNumber = 'RET-'.strtoupper(Str::random(8));

        $customerReturn = CustomerReturn::create([
            'company_id' => $order->company_id,
            'order_id' => $order->id,
            'return_number' => $returnNumber,
            'status' => 'pending_inspection',
            'return_reason' => $reason,
            'driver_notes' => $ctx->get('driver_notes'),
            'recorded_by' => $ctx->actorId ?? 'system',
        ]);

        foreach ($lines as $lineData) {
            $orderLine = $orderLinesById->get($lineData['order_line_id'] ?? '');

            CustomerReturnLine::create([
                'customer_return_id' => $customerReturn->id,
                'order_line_id' => $lineData['order_line_id'] ?? null,
                'product_id' => $lineData['product_id'] ?? ($orderLine?->product_id ?? ''),
                'sku_snapshot' => $lineData['sku_snapshot'] ?? ($orderLine?->product?->sku ?? ''),
                'name_snapshot' => $lineData['name_snapshot'] ?? ($orderLine?->product?->name ?? ''),
                'quantity_returned' => (float) ($lineData['quantity_returned'] ?? 0),
                'unit_cost_snapshot' => $lineData['unit_cost_snapshot'] ?? null,
                'condition' => $lineData['condition'] ?? 'sellable',
                'inspection_notes' => $lineData['inspection_notes'] ?? null,
            ]);
        }

        $order->update(['status' => OrderStatus::Returned]);
        $order->refresh();

        return FulfillmentResult::success(
            $order,
            "Order #{$order->order_number} marked as returned. CustomerReturn #{$returnNumber} created for inspection.",
            [
                'customer_return_id' => $customerReturn->id,
                'return_number' => $returnNumber,
                'return_reason' => $reason,
                'actor_id' => $ctx->actorId,
            ],
        );
    }

    /** @return list<object> */
    public function events(FulfillmentResult $result): array
    {
        return [
            new OrderReturnedEvent(
                orderId: $result->order->id,
                orderNumber: $result->order->order_number,
                companyId: $result->order->company_id ?? '',
                returnId: $result->meta['customer_return_id'] ?? '',
                returnReason: $result->meta['return_reason'] ?? '',
                returnedAt: now()->toIso8601String(),
                actorId: $result->meta['actor_id'] ?? null,
            ),
        ];
    }

    public function name(): string
    {
        return 'return_order';
    }
}
