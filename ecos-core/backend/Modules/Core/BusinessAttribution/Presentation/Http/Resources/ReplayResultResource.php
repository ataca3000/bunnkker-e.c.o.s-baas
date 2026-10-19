<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Core\BusinessAttribution\Domain\ValueObjects\ReplayResult;

class ReplayResultResource extends JsonResource
{
    public function __construct(private readonly ReplayResult $result) {}

    /** @param \Illuminate\Http\Request $request */
    public function toArray($request): array
    {
        return [
            'entity_type' => $this->result->entityType,
            'entity_id' => $this->result->entityId,
            'replay_type' => $this->result->replayType,
            'total_events' => $this->result->totalEvents,
            'replayed_at' => $this->result->replayedAt->toIso8601String(),
            'duration_ms' => $this->result->durationMs,
            'from' => $this->result->from?->toIso8601String(),
            'to' => $this->result->to?->toIso8601String(),
            'events' => BusinessEventResource::collection($this->result->events),
            'metadata' => $this->result->metadata,
        ];
    }
}
