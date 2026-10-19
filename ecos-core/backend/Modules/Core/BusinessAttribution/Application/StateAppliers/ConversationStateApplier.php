<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Application\StateAppliers;

use Modules\Core\BusinessAttribution\Domain\Contracts\EntityStateApplierInterface;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessEvent;

class ConversationStateApplier implements EntityStateApplierInterface
{
    public function supports(string $entityType): bool
    {
        return in_array(strtolower($entityType), ['conversation', 'conversations'], true);
    }

    public function initialState(string $entityId): array
    {
        return [
            'id' => $entityId,
            'entity_type' => 'conversation',
            'status' => 'open',
            'provider' => null,
            'customer_id' => null,
            'assigned_to' => null,
            'first_response_at' => null,
            'resolved_at' => null,
            'closed_at' => null,
            'messages_count' => 0,
            'unread_count' => 0,
            'last_event_at' => null,
        ];
    }

    public function apply(array $currentState, BusinessEvent $event): array
    {
        $payload = $event->payload ?? [];

        switch ($event->event_name) {
            case 'ConversationStarted':
            case 'ConversationCreated':
                $currentState['status'] = 'open';
                $currentState['provider'] = $payload['provider'] ?? null;
                $currentState['customer_id'] = $payload['customer_id'] ?? null;
                break;
            case 'MessageReceived':
            case 'InboundMessage':
                $currentState['messages_count'] += 1;
                $currentState['unread_count'] += 1;
                break;
            case 'MessageSent':
            case 'OutboundMessage':
                $currentState['messages_count'] += 1;
                $currentState['unread_count'] = 0;
                $currentState['first_response_at'] ??= $event->occurred_at->toIso8601String();
                break;
            case 'ConversationAssigned':
                $currentState['assigned_to'] = $payload['assignee_id'] ?? $event->actor_id;
                break;
            case 'ConversationResolved':
                $currentState['status'] = 'resolved';
                $currentState['resolved_at'] = $event->occurred_at->toIso8601String();
                break;
            case 'ConversationClosed':
                $currentState['status'] = 'closed';
                $currentState['closed_at'] = $event->occurred_at->toIso8601String();
                break;
        }

        $currentState['last_event_at'] = $event->occurred_at->toIso8601String();

        return $currentState;
    }
}
