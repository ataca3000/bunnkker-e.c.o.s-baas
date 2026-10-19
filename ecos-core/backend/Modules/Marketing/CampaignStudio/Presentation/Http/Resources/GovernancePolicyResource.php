<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class GovernancePolicyResource extends JsonResource
{
    /** @param \Illuminate\Http\Request $request */
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'company_id' => $this->company_id,
            'name' => $this->name,
            'description' => $this->description,
            'naming_pattern' => $this->naming_pattern,
            'naming_example' => $this->naming_example,
            'min_daily_budget' => $this->min_daily_budget,
            'max_daily_budget' => $this->max_daily_budget,
            'min_lifetime_budget' => $this->min_lifetime_budget,
            'max_lifetime_budget' => $this->max_lifetime_budget,
            'required_utm_params' => $this->required_utm_params,
            'required_assets' => $this->required_assets,
            'pixel_required' => $this->pixel_required,
            'approval_required' => $this->approval_required,
            'publishing_windows' => $this->publishing_windows,
            'blocked_publishing_days' => $this->blocked_publishing_days,
            'allowed_objectives' => $this->allowed_objectives,
            'brand_restrictions' => $this->brand_restrictions,
            'max_audience_age_gap' => $this->max_audience_age_gap,
            'is_active' => $this->is_active,
            'is_default' => $this->is_default,
            'created_by' => $this->created_by,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
