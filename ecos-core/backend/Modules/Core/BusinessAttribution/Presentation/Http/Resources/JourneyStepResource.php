<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Core\BusinessAttribution\Domain\Enums\JourneyStage;
use Modules\Core\BusinessAttribution\Domain\Models\JourneyStep;

/** @mixin JourneyStep */
class JourneyStepResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $stage = $this->journey_stage instanceof JourneyStage
            ? $this->journey_stage
            : JourneyStage::from($this->journey_stage);

        return [
            'id' => $this->id,
            'business_dna_id' => $this->business_dna_id,
            'journey_stage' => $stage->value,
            'journey_stage_label' => $stage->label(),
            'ordinal' => $stage->ordinal(),
            'event_id' => $this->event_id,
            'actor_id' => $this->actor_id,
            'actor_type' => $this->actor_type,
            'occurred_at' => $this->occurred_at instanceof \Carbon\Carbon
                ? $this->occurred_at->toIso8601String()
                : $this->occurred_at,
            'duration_seconds' => $this->duration_seconds,
            'previous_step_id' => $this->previous_step_id,
            'related_entity_id' => $this->related_entity_id,
            'related_entity_type' => $this->related_entity_type,
            'payload' => $this->payload,
            'created_at' => $this->created_at instanceof \Carbon\Carbon
                ? $this->created_at->toIso8601String()
                : $this->created_at,
        ];
    }
}
