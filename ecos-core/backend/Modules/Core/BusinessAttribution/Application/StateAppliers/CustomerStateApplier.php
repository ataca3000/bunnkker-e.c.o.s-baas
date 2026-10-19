<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Application\StateAppliers;

use Modules\Core\BusinessAttribution\Domain\Contracts\EntityStateApplierInterface;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessEvent;

class CustomerStateApplier implements EntityStateApplierInterface
{
    public function supports(string $entityType): bool
    {
        return in_array(strtolower($entityType), ['customer', 'customers'], true);
    }

    public function initialState(string $entityId): array
    {
        return [
            'id' => $entityId,
            'entity_type' => 'customer',
            'status' => 'unknown',
            'lifetime_stage' => null,
            'first_contact_at' => null,
            'first_order_at' => null,
            'last_order_at' => null,
            'total_orders' => 0,
            'total_spend' => 0.0,
            'journey_stages' => [],
            'last_event_at' => null,
        ];
    }

    public function apply(array $currentState, BusinessEvent $event): array
    {
        $payload = $event->payload ?? [];

        switch ($event->event_name) {
            case 'CustomerFirstContact':
            case 'ConversationStarted':
                $currentState['first_contact_at'] ??= $event->occurred_at->toIso8601String();
                $currentState['status'] = 'contacted';
                break;

            case 'LeadCreated':
            case 'LeadAssigned':
                $currentState['status'] = 'lead';
                break;

            case 'OrderCreated':
            case 'OrderPlaced':
                $currentState['total_orders'] += 1;
                $currentState['first_order_at'] ??= $event->occurred_at->toIso8601String();
                $currentState['last_order_at'] = $event->occurred_at->toIso8601String();
                $currentState['status'] = 'customer';
                if (isset($payload['total_amount'])) {
                    $currentState['total_spend'] += (float) $payload['total_amount'];
                }
                break;

            case 'RepeatPurchase':
                $currentState['lifetime_stage'] = 'repeat';
                $currentState['total_orders'] += 1;
                break;

            case 'VipUpgrade':
                $currentState['lifetime_stage'] = 'vip';
                break;
        }

        $category = $event->category?->value;
        if ($category && ! in_array($category, $currentState['journey_stages'], true)) {
            $currentState['journey_stages'][] = $category;
        }

        $currentState['last_event_at'] = $event->occurred_at->toIso8601String();

        return $currentState;
    }
}
