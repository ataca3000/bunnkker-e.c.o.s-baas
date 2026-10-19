<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Application\StateAppliers;

use Modules\Core\BusinessAttribution\Domain\Contracts\EntityStateApplierInterface;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessEvent;

class OrderStateApplier implements EntityStateApplierInterface
{
    public function supports(string $entityType): bool
    {
        return in_array(strtolower($entityType), ['order', 'orders'], true);
    }

    public function initialState(string $entityId): array
    {
        return [
            'id' => $entityId,
            'entity_type' => 'order',
            'status' => 'pending',
            'total_amount' => 0.0,
            'items_count' => 0,
            'channel_id' => null,
            'customer_id' => null,
            'placed_at' => null,
            'confirmed_at' => null,
            'paid_at' => null,
            'prepared_at' => null,
            'shipped_at' => null,
            'delivered_at' => null,
            'cancelled_at' => null,
            'last_event_at' => null,
            'history' => [],
        ];
    }

    public function apply(array $currentState, BusinessEvent $event): array
    {
        $payload = $event->payload ?? [];

        $currentState['history'][] = [
            'event' => $event->event_name,
            'occurred_at' => $event->occurred_at->toIso8601String(),
        ];

        switch ($event->event_name) {
            case 'OrderCreated':
            case 'OrderPlaced':
                $currentState['status'] = 'placed';
                $currentState['placed_at'] = $event->occurred_at->toIso8601String();
                $currentState['total_amount'] = (float) ($payload['total_amount'] ?? 0);
                $currentState['items_count'] = (int) ($payload['items_count'] ?? 0);
                $currentState['customer_id'] = $payload['customer_id'] ?? null;
                $currentState['channel_id'] = $payload['channel_id'] ?? null;
                break;
            case 'OrderConfirmed':
                $currentState['status'] = 'confirmed';
                $currentState['confirmed_at'] = $event->occurred_at->toIso8601String();
                break;
            case 'OrderPaymentReceived':
            case 'PaymentConfirmed':
                $currentState['status'] = 'paid';
                $currentState['paid_at'] = $event->occurred_at->toIso8601String();
                break;
            case 'OrderPrepared':
            case 'PreparationCompleted':
                $currentState['status'] = 'prepared';
                $currentState['prepared_at'] = $event->occurred_at->toIso8601String();
                break;
            case 'OrderShipped':
            case 'ShipmentDispatched':
                $currentState['status'] = 'shipped';
                $currentState['shipped_at'] = $event->occurred_at->toIso8601String();
                break;
            case 'OrderDelivered':
                $currentState['status'] = 'delivered';
                $currentState['delivered_at'] = $event->occurred_at->toIso8601String();
                break;
            case 'OrderCancelled':
                $currentState['status'] = 'cancelled';
                $currentState['cancelled_at'] = $event->occurred_at->toIso8601String();
                break;
        }

        $currentState['last_event_at'] = $event->occurred_at->toIso8601String();

        return $currentState;
    }
}
