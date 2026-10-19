<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Application\Actions;

use Modules\Core\BusinessAttribution\Application\Services\BusinessDnaService;
use Modules\Core\BusinessAttribution\Application\Services\BusinessEventBusService;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessEvent;

/**
 * Publish a business event into the Event Bus.
 * Optionally auto-attaches the event to a DNA record.
 */
final class PublishBusinessEventAction
{
    public function __construct(
        private readonly BusinessEventBusService $bus,
        private readonly BusinessDnaService $dnaService,
    ) {}

    /**
     * @param  array<string, mixed>  $eventData
     */
    public function execute(array $eventData): BusinessEvent
    {
        // Auto-resolve DNA if entity reference is provided but no explicit DNA ID
        if (
            empty($eventData['business_dna_id'])
            && ! empty($eventData['entity_type'])
            && ! empty($eventData['entity_id'])
        ) {
            $dna = $this->dnaService->getForEntity($eventData['entity_type'], $eventData['entity_id']);
            if ($dna !== null) {
                $eventData['business_dna_id'] = $dna->id;
            }
        }

        return $this->bus->publish($eventData);
    }
}
