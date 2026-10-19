<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Resources;

use BackedEnum;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LeadResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'conversation_id' => $this->conversation_id,
            'business_dna_id' => $this->business_dna_id,
            'company_id' => $this->company_id,
            'brand_id' => $this->brand_id,
            'channel_id' => $this->channel_id,
            'customer_name' => $this->customer_name,
            'customer_phone' => $this->customer_phone,
            'customer_email' => $this->customer_email,
            'status' => $this->status instanceof BackedEnum ? $this->status->value : $this->status,
            'status_label' => $this->status instanceof BackedEnum ? $this->status->label() : $this->status,
            'priority' => $this->priority instanceof BackedEnum ? $this->priority->value : $this->priority,
            'score' => $this->score,
            'assigned_to' => $this->assigned_to,
            'source' => $this->source,
            'qualification_notes' => $this->qualification_notes,
            'converted_entity_type' => $this->converted_entity_type,
            'converted_entity_id' => $this->converted_entity_id,
            'tags' => $this->tags ?? [],
            'qualified_at' => $this->qualified_at?->toIso8601String(),
            'converted_at' => $this->converted_at?->toIso8601String(),
            'lost_at' => $this->lost_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
