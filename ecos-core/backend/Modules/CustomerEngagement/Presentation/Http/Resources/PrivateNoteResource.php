<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PrivateNoteResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'conversation_id' => $this->conversation_id,
            'author_id' => $this->author_id,
            'author_type' => $this->author_type,
            'content' => $this->content,
            'mentioned_user_ids' => $this->mentioned_user_ids ?? [],
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
