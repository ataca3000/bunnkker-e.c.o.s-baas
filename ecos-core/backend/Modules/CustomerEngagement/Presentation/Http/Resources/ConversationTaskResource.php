<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class ConversationTaskResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'conversation_id' => $this->conversation_id,
            'title' => $this->title,
            'description' => $this->description,
            'due_at' => $this->due_at?->toIso8601String(),
            'assigned_to' => $this->assigned_to,
            'completed_at' => $this->completed_at?->toIso8601String(),
            'completed_by' => $this->completed_by,
            'is_done' => $this->isDone(),
            'is_overdue' => $this->isOverdue(),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
