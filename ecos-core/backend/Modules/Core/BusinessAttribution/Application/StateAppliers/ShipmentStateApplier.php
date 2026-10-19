<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Application\StateAppliers;

use Modules\Core\BusinessAttribution\Domain\Contracts\EntityStateApplierInterface;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessEvent;

class ShipmentStateApplier implements EntityStateApplierInterface
{
    public function supports(string $entityType): bool
    {
        return in_array(strtolower($entityType), ['shipment', 'shipments'], true);
    }

    public function initialState(string $entityId): array
    {
        return [
            'id' => $entityId,
            'entity_type' => 'shipment',
            'status' => 'pending',
            'order_id' => null,
            'carrier' => null,
            'tracking_code' => null,
            'dispatched_at' => null,
            'in_transit_at' => null,
            'out_for_delivery_at' => null,
            'delivered_at' => null,
            'failed_at' => null,
            'returned_at' => null,
            'attempts' => 0,
            'last_event_at' => null,
        ];
    }

    public function apply(array $currentState, BusinessEvent $event): array
    {
        $payload = $event->payload ?? [];

        switch ($event->event_name) {
            case 'ShipmentCreated':
                $currentState['order_id'] = $payload['order_id'] ?? null;
                $currentState['carrier'] = $payload['carrier'] ?? null;
                break;
            case 'ShipmentDispatched':
            case 'ShipmentPickedUp':
                $currentState['status'] = 'dispatched';
                $currentState['dispatched_at'] = $event->occurred_at->toIso8601String();
                $currentState['tracking_code'] = $payload['tracking_code'] ?? $currentState['tracking_code'];
                break;
            case 'ShipmentInTransit':
                $currentState['status'] = 'in_transit';
                $currentState['in_transit_at'] = $event->occurred_at->toIso8601String();
                break;
            case 'ShipmentOutForDelivery':
                $currentState['status'] = 'out_for_delivery';
                $currentState['out_for_delivery_at'] = $event->occurred_at->toIso8601String();
                $currentState['attempts'] += 1;
                break;
            case 'ShipmentDelivered':
                $currentState['status'] = 'delivered';
                $currentState['delivered_at'] = $event->occurred_at->toIso8601String();
                break;
            case 'ShipmentDeliveryFailed':
                $currentState['status'] = 'failed';
                $currentState['failed_at'] = $event->occurred_at->toIso8601String();
                $currentState['attempts'] += 1;
                break;
            case 'ShipmentReturned':
                $currentState['status'] = 'returned';
                $currentState['returned_at'] = $event->occurred_at->toIso8601String();
                break;
        }

        $currentState['last_event_at'] = $event->occurred_at->toIso8601String();

        return $currentState;
    }
}
