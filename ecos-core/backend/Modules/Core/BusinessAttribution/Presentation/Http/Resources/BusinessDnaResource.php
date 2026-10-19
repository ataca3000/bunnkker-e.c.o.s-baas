<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessDna;

/** @mixin BusinessDna */
class BusinessDnaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'entity_type' => $this->entity_type->value,
            'entity_type_label' => $this->entity_type->label(),
            'entity_id' => $this->entity_id,
            'origin_provider' => $this->origin_provider,
            'origin_platform' => $this->origin_platform,
            'initiative_id' => $this->initiative_id,
            'campaign_id' => $this->campaign_id,
            'ad_set_id' => $this->ad_set_id,
            'ad_id' => $this->ad_id,
            'creative_id' => $this->creative_id,
            'landing_page' => $this->landing_page,
            'conversation_source' => $this->conversation_source,
            'lead_source' => $this->lead_source,
            'sales_rep_id' => $this->sales_rep_id,
            'marketing_team' => $this->marketing_team,
            'company_id' => $this->company_id,
            'brand_id' => $this->brand_id,
            'channel_id' => $this->channel_id,
            'cost_center' => $this->cost_center,
            'business_unit' => $this->business_unit,
            'first_touch' => $this->first_touch,
            'last_touch' => $this->last_touch,
            'acquisition_timestamp' => $this->acquisition_timestamp?->toIso8601String(),
            'conversion_timestamp' => $this->conversion_timestamp?->toIso8601String(),
            'repeat_purchase_timestamp' => $this->repeat_purchase_timestamp?->toIso8601String(),
            'customer_lifetime_stage' => $this->customer_lifetime_stage,
            'attribution_model' => $this->attribution_model?->value,
            'is_converted' => $this->isConverted(),
            'has_repeat_purchase' => $this->hasRepeatPurchase(),
            'journey_steps' => $this->whenLoaded('journeySteps', fn () => JourneyStepResource::collection($this->journeySteps)),
            'metrics' => $this->whenLoaded('metrics', fn () => $this->metrics ? new BusinessMetricResource($this->metrics) : null),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
