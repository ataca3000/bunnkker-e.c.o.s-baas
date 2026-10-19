<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Application\StateAppliers;

use Modules\Core\BusinessAttribution\Domain\Contracts\EntityStateApplierInterface;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessEvent;

class LeadStateApplier implements EntityStateApplierInterface
{
    public function supports(string $entityType): bool
    {
        return in_array(strtolower($entityType), ['lead', 'leads'], true);
    }

    public function initialState(string $entityId): array
    {
        return [
            'id' => $entityId,
            'entity_type' => 'lead',
            'status' => 'new',
            'score' => 0,
            'assigned_to' => null,
            'assigned_at' => null,
            'qualified_at' => null,
            'converted_at' => null,
            'lost_at' => null,
            'last_event_at' => null,
            'contact_count' => 0,
        ];
    }

    public function apply(array $currentState, BusinessEvent $event): array
    {
        $payload = $event->payload ?? [];

        switch ($event->event_name) {
            case 'LeadCreated':
                $currentState['status'] = 'new';
                break;
            case 'LeadContacted':
                $currentState['status'] = 'contacted';
                $currentState['contact_count'] += 1;
                break;
            case 'LeadAssigned':
                $currentState['assigned_to'] = $payload['assigned_to'] ?? $event->actor_id;
                $currentState['assigned_at'] = $event->occurred_at->toIso8601String();
                break;
            case 'LeadQualified':
                $currentState['status'] = 'qualified';
                $currentState['qualified_at'] = $event->occurred_at->toIso8601String();
                break;
            case 'LeadDisqualified':
            case 'LeadUnqualified':
                $currentState['status'] = 'unqualified';
                break;
            case 'LeadConverted':
                $currentState['status'] = 'converted';
                $currentState['converted_at'] = $event->occurred_at->toIso8601String();
                break;
            case 'LeadLost':
                $currentState['status'] = 'lost';
                $currentState['lost_at'] = $event->occurred_at->toIso8601String();
                break;
            case 'LeadScoreUpdated':
                $currentState['score'] = (int) ($payload['score'] ?? $currentState['score']);
                break;
        }

        $currentState['last_event_at'] = $event->occurred_at->toIso8601String();

        return $currentState;
    }
}
