<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AudienceSegmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'company_id' => $this->company_id,
            'segment_type' => $this->segment_type->value,
            'rules' => $this->rules,
            'entity_type' => $this->entity_type,
            'member_count' => $this->member_count,
            'is_dynamic' => $this->is_dynamic,
            'is_active' => $this->is_active,
            'last_calculated_at' => $this->last_calculated_at,
            'created_by' => $this->created_by,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
