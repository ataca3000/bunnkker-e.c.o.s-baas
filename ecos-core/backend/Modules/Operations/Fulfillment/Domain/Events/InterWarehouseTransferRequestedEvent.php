<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * P1-005 — Inter-warehouse transfer integration hook.
 *
 * Emitted when ProcessOrderWorkflow routes an order to AwaitingStock but
 * detects that the required products are available in at least one other
 * warehouse. This event is the boundary between the Orders module and the
 * future Inventory Transfer engine — downstream listeners may auto-create a
 * transfer request, alert an operations manager, or log a sourcing opportunity.
 *
 * This event does NOT trigger any inventory movement. It is advisory only.
 * The transfer engine must validate quantities before executing any move.
 */
final class InterWarehouseTransferRequestedEvent
{
    use Dispatchable, SerializesModels;

    /**
     * @param  list<array{product_id: string, sku: string|null, required_qty: float, available_warehouses: list<array{warehouse_id: string, available_qty: float}>}>  $shortageLines
     */
    public function __construct(
        public readonly string $orderId,
        public readonly string $orderNumber,
        public readonly string $companyId,
        public readonly string $assignedWarehouseId,
        public readonly array $shortageLines,
        public readonly string $requestedAt,
        public readonly ?string $actorId,
    ) {}
}
