<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Core\BusinessAttribution\Domain\ValueObjects\EntityState;

class EntityStateResource extends JsonResource
{
    public function __construct(private readonly EntityState $entityState) {}

    /** @param \Illuminate\Http\Request $request */
    public function toArray($request): array
    {
        return [
            'data' => [
                'entity_type' => $this->entityState->entityType,
                'entity_id' => $this->entityState->entityId,
                'as_of' => $this->entityState->asOf->toIso8601String(),
                'events_applied' => $this->entityState->eventsApplied,
                'last_event_at' => $this->entityState->lastEventAt?->toIso8601String(),
                'state' => $this->entityState->state,
            ],
        ];
    }
}
