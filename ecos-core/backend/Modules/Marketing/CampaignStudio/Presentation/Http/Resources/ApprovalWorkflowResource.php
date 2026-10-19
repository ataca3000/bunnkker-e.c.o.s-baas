<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class ApprovalWorkflowResource extends JsonResource
{
    /** @param \Illuminate\Http\Request $request */
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'company_id' => $this->company_id,
            'name' => $this->name,
            'description' => $this->description,
            'is_default' => $this->is_default,
            'is_active' => $this->is_active,
            'steps' => $this->whenLoaded('steps', fn () => $this->steps->map(fn ($s) => [
                'id' => $s->id,
                'step_order' => $s->step_order,
                'step_name' => $s->step_name,
                'role_required' => $s->role_required,
                'user_id_required' => $s->user_id_required,
                'requires_all' => $s->requires_all,
                'is_optional' => $s->is_optional,
                'timeout_hours' => $s->timeout_hours,
                'on_timeout_action' => $s->on_timeout_action,
            ])),
            'created_by' => $this->created_by,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
