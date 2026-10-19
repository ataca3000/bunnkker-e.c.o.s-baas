<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class CampaignTemplateResource extends JsonResource
{
    /** @param \Illuminate\Http\Request $request */
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'company_id' => $this->company_id,
            'name' => $this->name,
            'description' => $this->description,
            'category' => $this->category?->value,
            'category_label' => $this->category?->label(),
            'preview_image_url' => $this->preview_image_url,
            'default_objective' => $this->default_objective,
            'default_buying_type' => $this->default_buying_type,
            'default_budget_type' => $this->default_budget_type,
            'default_daily_budget' => $this->default_daily_budget,
            'default_bid_strategy' => $this->default_bid_strategy,
            'default_optimization_goal' => $this->default_optimization_goal,
            'default_audience' => $this->default_audience,
            'default_placements' => $this->default_placements,
            'default_business_goal' => $this->default_business_goal,
            'default_season' => $this->default_season,
            'required_assets' => $this->required_assets,
            'required_utm_params' => $this->required_utm_params,
            'approval_workflow_id' => $this->approval_workflow_id,
            'is_global' => $this->is_global,
            'is_active' => $this->is_active,
            'usage_count' => $this->usage_count,
            'created_by' => $this->created_by,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
