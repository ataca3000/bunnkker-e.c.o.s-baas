<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Resources;

use BackedEnum;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AssignmentLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'conversation_id' => $this->conversation_id,
            'assignee_type' => $this->assignee_type,
            'assignee_id' => $this->assignee_id,
            'assigned_by' => $this->assigned_by,
            'assignment_type' => $this->assignment_type instanceof BackedEnum ? $this->assignment_type->value : $this->assignment_type,
            'notes' => $this->notes,
            'unassigned_at' => $this->unassigned_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
