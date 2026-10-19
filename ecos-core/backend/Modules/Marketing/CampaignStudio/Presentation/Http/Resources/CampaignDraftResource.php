<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class CampaignDraftResource extends JsonResource
{
    /** @param \Illuminate\Http\Request $request */
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'internal_status' => $this->internal_status?->value,
            'internal_status_label' => $this->internal_status?->label(),
            'internal_status_color' => $this->internal_status?->color(),

            // Business context
            'initiative_id' => $this->initiative_id,
            'company_id' => $this->company_id,
            'brand_id' => $this->brand_id,
            'channel_id' => $this->channel_id,
            'campaign_owner_id' => $this->campaign_owner_id,
            'budget_owner' => $this->budget_owner,
            'marketing_team' => $this->marketing_team,
            'cost_center' => $this->cost_center,
            'season' => $this->season,
            'custom_season' => $this->custom_season,
            'business_goal' => $this->business_goal,
            'tags' => $this->tags ?? [],
            'internal_notes' => $this->internal_notes,

            // Campaign settings
            'objective' => $this->objective,
            'buying_type' => $this->buying_type,
            'budget_type' => $this->budget_type?->value,
            'daily_budget' => $this->daily_budget,
            'lifetime_budget' => $this->lifetime_budget,
            'bid_strategy' => $this->bid_strategy,
            'optimization_goal' => $this->optimization_goal,
            'timezone' => $this->timezone,
            'start_date' => $this->start_date?->toIso8601String(),
            'end_date' => $this->end_date?->toIso8601String(),

            // Connected assets
            'connector_type' => $this->connector_type,
            'connection_id' => $this->connection_id,
            'ad_account_id' => $this->ad_account_id,
            'business_manager_id' => $this->business_manager_id,
            'page_id' => $this->page_id,
            'instagram_account_id' => $this->instagram_account_id,
            'pixel_id' => $this->pixel_id,
            'catalog_id' => $this->catalog_id,
            'domain' => $this->domain,

            // Provider identity (after publishing)
            'external_campaign_id' => $this->external_campaign_id,
            'linked_campaign_id' => $this->linked_campaign_id,

            // Versioning
            'current_version_number' => $this->current_version_number,
            'current_version_id' => $this->current_version_id,

            // Workflow refs
            'approval_workflow_id' => $this->approval_workflow_id,
            'template_id' => $this->template_id,
            'governance_policy_id' => $this->governance_policy_id,

            // Timestamps
            'published_at' => $this->published_at?->toIso8601String(),
            'scheduled_publish_at' => $this->scheduled_publish_at?->toIso8601String(),
            'submitted_for_approval_at' => $this->submitted_for_approval_at?->toIso8601String(),

            // Editable flag
            'is_editable' => $this->isEditable(),

            // Relationships (when loaded)
            'audience' => $this->whenLoaded('audience'),
            'creatives' => $this->whenLoaded('creatives'),
            'placement' => $this->whenLoaded('placement'),
            'current_approval' => $this->whenLoaded('currentApproval', fn () => new CampaignApprovalResource($this->currentApproval)),
            'publishing_jobs' => $this->whenLoaded('publishingJobs', fn () => PublishingJobResource::collection($this->publishingJobs)),
            'versions' => $this->whenLoaded('versions', fn () => CampaignVersionResource::collection($this->versions)),
            'products' => $this->whenLoaded('products'),
            'validation_results' => $this->whenLoaded('validationResults', fn () => ValidationResultResource::collection($this->validationResults)),

            'created_by' => $this->created_by,
            'updated_by' => $this->updated_by,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
