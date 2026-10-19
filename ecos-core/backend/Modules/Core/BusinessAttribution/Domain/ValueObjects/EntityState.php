<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\ValueObjects;

use Carbon\Carbon;

final readonly class EntityState
{
    public function __construct(
        public string $entityType,
        public string $entityId,
        public Carbon $asOf,
        public array $state,
        public int $eventsApplied,
        public ?Carbon $lastEventAt = null,
        public array $appliedEvents = [],
    ) {}

    public function get(string $key, mixed $default = null): mixed
    {
        return $this->state[$key] ?? $default;
    }

    public function has(string $key): bool
    {
        return array_key_exists($key, $this->state);
    }

    public function toArray(): array
    {
        return [
            'entity_type' => $this->entityType,
            'entity_id' => $this->entityId,
            'as_of' => $this->asOf->toIso8601String(),
            'events_applied' => $this->eventsApplied,
            'last_event_at' => $this->lastEventAt?->toIso8601String(),
            'state' => $this->state,
        ];
    }
}
