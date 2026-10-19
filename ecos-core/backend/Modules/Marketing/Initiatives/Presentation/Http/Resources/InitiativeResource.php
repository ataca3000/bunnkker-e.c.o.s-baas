<?php

declare(strict_types=1);

namespace Modules\Marketing\Initiatives\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class InitiativeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'company_id' => $this->company_id,
            'brand_id' => $this->brand_id,
            'channel_id' => $this->channel_id,
            'template_id' => $this->template_id,
            'name' => $this->name,
            'description' => $this->description,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'business_unit' => $this->business_unit,
            'season' => $this->season?->value,
            'business_goal' => $this->business_goal?->value,
            'cost_center' => $this->cost_center,
            'budget' => $this->budget,
            'currency' => $this->currency,
            'start_date' => $this->start_date?->toDateString(),
            'end_date' => $this->end_date?->toDateString(),
            'owner_id' => $this->owner_id,
            'marketing_team' => $this->marketing_team,
            'internal_notes' => $this->internal_notes,
            'tags' => $this->tags,
            'created_by' => $this->created_by,
            'updated_by' => $this->updated_by,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),

            // Computed
            'days_remaining' => $this->daysRemaining(),
            'progress_percent' => $this->progressPercent(),
            'is_on_schedule' => $this->isOnSchedule(),

            // Related
            'campaigns_count' => $this->whenCounted('campaigns'),
            'template' => $this->whenLoaded('template', fn () => [
                'id' => $this->template?->id,
                'name' => $this->template?->name,
                'slug' => $this->template?->slug,
            ]),
        ];
    }
}
