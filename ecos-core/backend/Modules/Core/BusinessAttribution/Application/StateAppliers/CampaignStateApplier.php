<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Application\StateAppliers;

use Modules\Core\BusinessAttribution\Domain\Contracts\EntityStateApplierInterface;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessEvent;

class CampaignStateApplier implements EntityStateApplierInterface
{
    public function supports(string $entityType): bool
    {
        return in_array(strtolower($entityType), ['campaign', 'campaigns'], true);
    }

    public function initialState(string $entityId): array
    {
        return [
            'id' => $entityId,
            'entity_type' => 'campaign',
            'status' => 'draft',
            'impressions' => 0,
            'clicks' => 0,
            'conversions' => 0,
            'spend' => 0.0,
            'leads_generated' => 0,
            'orders_generated' => 0,
            'launched_at' => null,
            'paused_at' => null,
            'completed_at' => null,
            'last_event_at' => null,
        ];
    }

    public function apply(array $currentState, BusinessEvent $event): array
    {
        $payload = $event->payload ?? [];

        switch ($event->event_name) {
            case 'CampaignLaunched':
            case 'CampaignActivated':
                $currentState['status'] = 'active';
                $currentState['launched_at'] = $event->occurred_at->toIso8601String();
                break;
            case 'CampaignPaused':
                $currentState['status'] = 'paused';
                $currentState['paused_at'] = $event->occurred_at->toIso8601String();
                break;
            case 'CampaignCompleted':
            case 'CampaignEnded':
                $currentState['status'] = 'completed';
                $currentState['completed_at'] = $event->occurred_at->toIso8601String();
                break;
            case 'AdImpression':
                $currentState['impressions'] += (int) ($payload['count'] ?? 1);
                break;
            case 'AdClick':
                $currentState['clicks'] += (int) ($payload['count'] ?? 1);
                break;
            case 'CampaignConversion':
                $currentState['conversions'] += 1;
                break;
            case 'LeadGeneratedFromCampaign':
                $currentState['leads_generated'] += 1;
                break;
            case 'OrderGeneratedFromCampaign':
                $currentState['orders_generated'] += 1;
                break;
            case 'AdSpendRecorded':
                $currentState['spend'] += (float) ($payload['amount'] ?? 0);
                break;
        }

        $currentState['last_event_at'] = $event->occurred_at->toIso8601String();

        return $currentState;
    }
}
