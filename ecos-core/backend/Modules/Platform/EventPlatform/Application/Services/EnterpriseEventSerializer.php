<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Application\Services;

use Modules\Inventory\DomainEvents\Contracts\DomainEvent;
use Modules\POS\Shared\Domain\Contracts\DomainEvent as PosDomainEvent;
use Modules\Platform\EventPlatform\Domain\Abstracts\EnterpriseEvent;

final class EnterpriseEventSerializer
{
    /**
     * Serialize a DomainEvent (or EnterpriseEvent) to a storable array.
     * Lazy: only triggers toArray() once.
     */
    public function serialize(DomainEvent|PosDomainEvent $event): array
    {
        $data = $event->toArray();

        // Bridge for legacy DomainEvent objects that don't extend EnterpriseEvent
        if (! ($event instanceof EnterpriseEvent)) {
            $data = $this->normalizeLegacyEvent($event, $data);
        }

        return $data;
    }

    /**
     * Deserialize stored array back to event data.
     * Returns the raw array; callers are responsible for class reconstruction.
     */
    public function deserialize(array $stored): array
    {
        foreach (['payload', 'metadata'] as $field) {
            if (isset($stored[$field]) && is_string($stored[$field])) {
                $stored[$field] = json_decode($stored[$field], true) ?? [];
            }
        }

        return $stored;
    }

    /**
     * Build a canonical envelope for a legacy DomainEvent that hasn't been migrated yet.
     * Extracts the payload sub-array if present; otherwise wraps all extra keys.
     */
    private function normalizeLegacyEvent(DomainEvent|PosDomainEvent $event, array $raw): array
    {
        // Legacy events include all fields in toArray() with a 'payload' sub-key
        $inner = $raw['payload'] ?? $raw;

        return [
            'event_id' => $event->eventId(),
            'event_name' => $event->eventName(),
            'version' => (string) $event->eventVersion(),
            'occurred_at' => $event->occurredAt()->format('Y-m-d H:i:s'),
            'correlation_id' => $event->correlationId(),
            'causation_id' => $raw['causation_id'] ?? null,
            'company_id' => $raw['company_id'] ?? null,
            'warehouse_id' => $raw['warehouse_id'] ?? null,
            'module' => $raw['source_module'] ?? $this->guessModuleFromClass($event),
            'aggregate_type' => $raw['aggregate_type'] ?? null,
            'aggregate_id' => $raw['aggregate_id'] ?? null,
            'payload' => is_array($inner) ? $inner : $raw,
            'metadata' => $raw['metadata'] ?? [],
            'retry_count' => 0,
            'is_replay' => false,
            'trace_id' => $raw['trace_id'] ?? $event->correlationId(),
            'event_class' => $event::class,
        ];
    }

    private function guessModuleFromClass(DomainEvent|PosDomainEvent $event): string
    {
        $parts = explode('\\', $event::class);

        return strtolower($parts[1] ?? 'unknown').'.'.strtolower($parts[2] ?? 'unknown');
    }
}
