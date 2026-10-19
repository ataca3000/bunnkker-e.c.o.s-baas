<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Listeners;

use Illuminate\Support\Facades\Log;
use Modules\Commerce\Orders\Domain\Models\OrderEvent;
use Modules\Core\BusinessAttribution\Application\Services\BusinessEventBusService;
use Modules\Operations\Fulfillment\Domain\Events\OrderDeliveredEvent;
use Throwable;

/**
 * Handles post-delivery business integration:
 *  1. Stamps an immutable order_delivered audit entry with full P&L context.
 *  2. Publishes a commerce.order_delivered revenue event to the BAE — this is the
 *     canonical signal for revenue recognition, loyalty triggers, and sales analytics.
 *     Revenue, COGS, and margin are recorded at the moment of delivery so the BAE
 *     can build accurate period-level P&L reports without re-querying orders.
 */
final class HandleOrderDelivered
{
    public function __construct(
        private readonly BusinessEventBusService $eventBus,
    ) {}

    public function handle(OrderDeliveredEvent $event): void
    {
        try {
            OrderEvent::log(
                orderId: $event->orderId,
                type: 'order_delivered',
                description: "Order #{$event->orderNumber} delivered.",
                payload: [
                    'revenue' => $event->revenue,
                    'cogs_amount' => $event->cogsAmount,
                    'margin_amount' => $event->marginAmount,
                    'margin_percent' => $event->marginPercent,
                    'delivered_at' => $event->deliveredAt,
                ],
                actorId: $event->actorId,
            );
        } catch (Throwable $e) {
            Log::channel('daily')->error('[HandleOrderDelivered] Audit log failed', [
                'order_id' => $event->orderId,
                'error' => $e->getMessage(),
            ]);
        }

        try {
            $this->eventBus->publish([
                'event_name' => 'order.delivered',
                'category' => 'commerce',
                'producer_module' => 'Operations.Fulfillment',
                'producer_entity' => 'Order',
                'entity_id' => $event->orderId,
                'entity_type' => 'order',
                'company_id' => $event->companyId,
                'actor_id' => $event->actorId,
                'occurred_at' => $event->deliveredAt,
                'payload' => [
                    'order_number' => $event->orderNumber,
                    'revenue' => $event->revenue,
                    'cogs_amount' => $event->cogsAmount,
                    'margin_amount' => $event->marginAmount,
                    'margin_percent' => $event->marginPercent,
                ],
            ]);
        } catch (Throwable $e) {
            Log::channel('daily')->error('[HandleOrderDelivered] BAE publish failed', [
                'order_id' => $event->orderId,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
