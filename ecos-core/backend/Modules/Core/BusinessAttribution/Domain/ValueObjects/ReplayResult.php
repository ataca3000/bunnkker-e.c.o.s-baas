<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Domain\ValueObjects;

use Carbon\Carbon;
use Illuminate\Support\Collection;

final readonly class ReplayResult
{
    public function __construct(
        public string $entityType,
        public string $entityId,
        public Collection $events,
        public int $totalEvents,
        public Carbon $replayedAt,
        public int $durationMs,
        public ?Carbon $from = null,
        public ?Carbon $to = null,
        public string $replayType = 'entity',
        public array $metadata = [],
    ) {}

    public function toArray(): array
    {
        return [
            'entity_type' => $this->entityType,
            'entity_id' => $this->entityId,
            'replay_type' => $this->replayType,
            'total_events' => $this->totalEvents,
            'replayed_at' => $this->replayedAt->toIso8601String(),
            'duration_ms' => $this->durationMs,
            'from' => $this->from?->toIso8601String(),
            'to' => $this->to?->toIso8601String(),
            'events' => $this->events->toArray(),
            'metadata' => $this->metadata,
        ];
    }

    public function isEmpty(): bool
    {
        return $this->totalEvents === 0;
    }
}
