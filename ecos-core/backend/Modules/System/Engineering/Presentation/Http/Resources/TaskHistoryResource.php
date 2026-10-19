<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TaskHistoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'event_type'  => $this->event_type,
            'from_status' => $this->from_status,
            'to_status'   => $this->to_status,
            'actor_id'    => $this->actor_id,
            'actor_type'  => $this->actor_type,
            'reason'      => $this->reason,
            'occurred_at' => $this->occurred_at->toIsoString(),

            'actor' => $this->whenLoaded('actor', fn () => [
                'id'   => $this->actor->id,
                'name' => $this->actor->name,
            ]),
        ];
    }
}
