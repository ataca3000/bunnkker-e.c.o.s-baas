<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class ConversationMacroResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'company_id' => $this->company_id,
            'name' => $this->name,
            'shortcut' => $this->shortcut,
            'category' => $this->category,
            'content' => $this->content,
            'variables' => $this->variables ?? [],
            'applies_to_channels' => $this->applies_to_channels,
            'usage_count' => $this->usage_count,
            'is_shared' => $this->is_shared,
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
