<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Listeners;

use Illuminate\Support\Facades\Log;
use Modules\Commerce\Orders\Domain\Models\OrderEvent;
use Modules\Core\BusinessAttribution\Application\Services\BusinessEventBusService;
use Modules\Operations\Fulfillment\Domain\Events\OrderConfirmedEvent;
use Throwable;

/**
 * Handles post-confirmation business integration:
 *  1. Stamps an immutable order_confirmed audit entry.
 *  2. Publishes a commerce.order_confirmed event to the Business Attribution Engine
 *     so downstream analytics, attribution, and AI can react to the confirmation.
 */
final class HandleOrderConfirmed
{
    public function __construct(
        private readonly BusinessEventBusService $eventBus,
    ) {}

    public function handle(OrderConfirmedEvent $event): void
    {
        try {
            OrderEvent::log(
                orderId: $event->orderId,
                type: 'order_confirmed',
                description: "Order #{$event->orderNumber} confirmed. Inventory reserved.",
                payload: [
                    'warehouse_id' => $event->warehouseId,
                    'reserved_at' => $event->reservedAt,
                    'snapshot_created' => $event->snapshotCreated,
                ],
                actorId: $event->actorId,
            );
        } catch (Throwable $e) {
            Log::channel('daily')->error('[HandleOrderConfirmed] Audit log failed', [
                'order_id' => $event->orderId,
                'error' => $e->getMessage(),
            ]);
        }

        try {
            $this->eventBus->publish([
                'event_name' => 'order.confirmed',
                'category' => 'commerce',
                'producer_module' => 'Operations.Fulfillment',
                'producer_entity' => 'Order',
                'entity_id' => $event->orderId,
                'entity_type' => 'order',
                'company_id' => $event->companyId,
                'warehouse_id' => $event->warehouseId,
                'actor_id' => $event->actorId,
                'occurred_at' => $event->reservedAt,
                'payload' => [
                    'order_number' => $event->orderNumber,
                    'snapshot_created' => $event->snapshotCreated,
                ],
            ]);
        } catch (Throwable $e) {
            Log::channel('daily')->error('[HandleOrderConfirmed] BAE publish failed', [
                'order_id' => $event->orderId,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
