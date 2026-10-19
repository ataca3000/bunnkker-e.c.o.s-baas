<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class CampaignVersionResource extends JsonResource
{
    /** @param \Illuminate\Http\Request $request */
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'campaign_draft_id' => $this->campaign_draft_id,
            'version_number' => $this->version_number,
            'change_type' => $this->change_type?->value,
            'change_type_label' => $this->change_type?->label(),
            'changed_fields' => $this->changed_fields,
            'change_note' => $this->change_note,
            'changed_by_user_id' => $this->changed_by_user_id,
            'approval_decision' => $this->approval_decision,
            'approved_by_user_id' => $this->approved_by_user_id,
            'approval_decided_at' => $this->approval_decided_at?->toIso8601String(),
            'snapshot' => $this->when($request->boolean('include_snapshot'), $this->snapshot),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
