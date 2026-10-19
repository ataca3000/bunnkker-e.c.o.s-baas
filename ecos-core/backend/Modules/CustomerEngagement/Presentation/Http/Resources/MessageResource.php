<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Resources;

use BackedEnum;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'conversation_id' => $this->conversation_id,
            'external_message_id' => $this->external_message_id,
            'direction' => $this->direction instanceof BackedEnum ? $this->direction->value : $this->direction,
            'message_type' => $this->message_type instanceof BackedEnum ? $this->message_type->value : $this->message_type,
            'content' => $this->content,
            'media_url' => $this->media_url,
            'media_type' => $this->media_type,
            'media_size' => $this->media_size,
            'sender_type' => $this->sender_type,
            'sender_id' => $this->sender_id,
            'sender_name' => $this->sender_name,
            'is_read' => $this->is_read,
            'is_deleted' => $this->is_deleted,
            'sent_at' => $this->sent_at?->toIso8601String(),
            'delivered_at' => $this->delivered_at?->toIso8601String(),
            'read_at' => $this->read_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
