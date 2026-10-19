<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class ValidationResultResource extends JsonResource
{
    /** @param \Illuminate\Http\Request $request */
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'validation_type' => $this->validation_type,
            'severity' => $this->severity?->value,
            'severity_label' => $this->severity?->label(),
            'severity_color' => $this->severity?->color(),
            'blocks_publishing' => $this->severity?->blocksPublishing(),
            'message' => $this->message,
            'field_path' => $this->field_path,
            'context' => $this->context,
            'is_resolved' => $this->is_resolved,
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'validated_at' => $this->validated_at?->toIso8601String(),
        ];
    }
}
