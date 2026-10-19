<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class CampaignApprovalResource extends JsonResource
{
    /** @param \Illuminate\Http\Request $request */
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'campaign_draft_id' => $this->campaign_draft_id,
            'workflow_template_id' => $this->workflow_template_id,
            'current_step_order' => $this->current_step_order,
            'status' => $this->status?->value,
            'status_label' => $this->status?->label(),
            'status_color' => $this->status?->color(),
            'submitted_by' => $this->submitted_by,
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'rejection_reason' => $this->rejection_reason,
            'workflow_steps' => $this->whenLoaded('workflowTemplate', fn () => $this->workflowTemplate?->steps),
            'decisions' => $this->whenLoaded('decisions'),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
