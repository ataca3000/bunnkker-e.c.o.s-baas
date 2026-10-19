<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\Listeners;

use Illuminate\Support\Facades\Log;
use Modules\Commerce\Orders\Domain\Models\OrderEvent;
use Modules\Core\BusinessAttribution\Application\Services\BusinessEventBusService;
use Modules\Operations\Fulfillment\Domain\Events\OrderDispatchedEvent;
use Throwable;

/**
 * Handles post-dispatch business integration:
 *  1. Stamps an immutable order_dispatched audit entry with vehicle/driver context.
 *  2. Publishes a logistics.order_dispatched event to the BAE — feeds logistics
 *     performance tracking, delivery SLA analytics, and driver attribution.
 */
final class HandleOrderDispatched
{
    public function __construct(
        private readonly BusinessEventBusService $eventBus,
    ) {}

    public function handle(OrderDispatchedEvent $event): void
    {
        try {
            OrderEvent::log(
                orderId: $event->orderId,
                type: 'order_dispatched',
                description: "Order #{$event->orderNumber} dispatched. Vehicle assignment #{$event->vehicleAssignmentId}.",
                payload: [
                    'vehicle_assignment_id' => $event->vehicleAssignmentId,
                    'vehicle_id' => $event->vehicleId,
                    'driver_id' => $event->driverId,
                    'cogs_amount' => $event->cogsAmount,
                    'dispatched_at' => $event->dispatchedAt,
                ],
                actorId: $event->actorId,
            );
        } catch (Throwable $e) {
            Log::channel('daily')->error('[HandleOrderDispatched] Audit log failed', [
                'order_id' => $event->orderId,
                'error' => $e->getMessage(),
            ]);
        }

        try {
            $this->eventBus->publish([
                'event_name' => 'order.dispatched',
                'category' => 'logistics',
                'producer_module' => 'Operations.Fulfillment',
                'producer_entity' => 'Order',
                'entity_id' => $event->orderId,
                'entity_type' => 'order',
                'company_id' => $event->companyId,
                'actor_id' => $event->actorId,
                'occurred_at' => $event->dispatchedAt,
                'payload' => [
                    'order_number' => $event->orderNumber,
                    'vehicle_assignment_id' => $event->vehicleAssignmentId,
                    'vehicle_id' => $event->vehicleId,
                    'driver_id' => $event->driverId,
                    'cogs_amount' => $event->cogsAmount,
                ],
            ]);
        } catch (Throwable $e) {
            Log::channel('daily')->error('[HandleOrderDispatched] BAE publish failed', [
                'order_id' => $event->orderId,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
