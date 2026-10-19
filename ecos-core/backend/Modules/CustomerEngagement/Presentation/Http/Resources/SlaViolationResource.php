<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Resources;

use BackedEnum;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SlaViolationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'conversation_id' => $this->conversation_id,
            'sla_policy_id' => $this->sla_policy_id,
            'violation_type' => $this->violation_type instanceof BackedEnum ? $this->violation_type->value : $this->violation_type,
            'status' => $this->status,
            'due_at' => $this->due_at?->toIso8601String(),
            'breached_at' => $this->breached_at?->toIso8601String(),
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'is_breached' => $this->isBreached(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
