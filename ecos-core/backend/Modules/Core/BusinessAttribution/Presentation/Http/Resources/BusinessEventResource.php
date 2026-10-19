<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessEvent;

/** @mixin BusinessEvent */
class BusinessEventResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'event_uuid' => $this->event_uuid,
            'event_name' => $this->event_name,
            'category' => $this->category->value,
            'category_label' => $this->category->label(),
            'producer_module' => $this->producer_module,
            'producer_entity' => $this->producer_entity,
            'entity_id' => $this->entity_id,
            'entity_type' => $this->entity_type,
            'company_id' => $this->company_id,
            'brand_id' => $this->brand_id,
            'channel_id' => $this->channel_id,
            'actor_id' => $this->actor_id,
            'actor_type' => $this->actor_type,
            'occurred_at' => $this->occurred_at?->toIso8601String(),
            'correlation_id' => $this->correlation_id,
            'business_dna_id' => $this->business_dna_id,
            'payload' => $this->payload,
            'metadata' => $this->metadata,
            'version' => $this->version,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
