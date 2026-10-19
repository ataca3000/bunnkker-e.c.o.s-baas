<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class ReplayAuditLogResource extends JsonResource
{
    /** @param \Illuminate\Http\Request $request */
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'target_entity_type' => $this->target_entity_type,
            'target_entity_id' => $this->target_entity_id,
            'replay_type' => $this->replay_type,
            'replay_from' => $this->replay_from?->toIso8601String(),
            'replay_to' => $this->replay_to?->toIso8601String(),
            'replay_as_of' => $this->replay_as_of?->toIso8601String(),
            'replay_purpose' => $this->replay_purpose,
            'events_replayed' => $this->events_replayed,
            'duration_ms' => $this->duration_ms,
            'status' => $this->status,
            'executed_at' => $this->executed_at?->toIso8601String(),
        ];
    }
}
