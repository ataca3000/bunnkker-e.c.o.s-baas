<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Resources;

use BackedEnum;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ConversationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'conversation_uuid' => $this->conversation_uuid,
            'provider' => $this->provider instanceof BackedEnum ? $this->provider->value : $this->provider,
            'provider_label' => $this->provider instanceof BackedEnum ? $this->provider->label() : $this->provider,
            'external_conversation_id' => $this->external_conversation_id,
            'customer_id' => $this->customer_id,
            'customer_name' => $this->customer_name,
            'customer_phone' => $this->customer_phone,
            'customer_email' => $this->customer_email,
            'business_dna_id' => $this->business_dna_id,
            'company_id' => $this->company_id,
            'brand_id' => $this->brand_id,
            'channel_id' => $this->channel_id,
            'initiative_id' => $this->initiative_id,
            'campaign_id' => $this->campaign_id,
            'assigned_team_id' => $this->assigned_team_id,
            'assigned_employee_id' => $this->assigned_employee_id,
            'sla_policy_id' => $this->sla_policy_id,
            'status' => $this->status instanceof BackedEnum ? $this->status->value : $this->status,
            'status_label' => $this->status instanceof BackedEnum ? $this->status->label() : $this->status,
            'priority' => $this->priority instanceof BackedEnum ? $this->priority->value : $this->priority,
            'priority_label' => $this->priority instanceof BackedEnum ? $this->priority->label() : $this->priority,
            'source' => $this->source,
            'language' => $this->language,
            'sentiment' => $this->sentiment,
            'tags' => $this->tags ?? [],
            'messages_count' => $this->messages_count,
            'unread_count' => $this->unread_count,
            'internal_notes_count' => $this->internal_notes_count,
            'first_response_at' => $this->first_response_at?->toIso8601String(),
            'last_message_at' => $this->last_message_at?->toIso8601String(),
            'last_agent_message_at' => $this->last_agent_message_at?->toIso8601String(),
            'started_at' => $this->started_at?->toIso8601String(),
            'closed_at' => $this->closed_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'messages' => MessageResource::collection($this->whenLoaded('messages')),
            'sla_violations' => SlaViolationResource::collection($this->whenLoaded('slaViolations')),
            'lead' => new LeadResource($this->whenLoaded('lead')),
        ];
    }
}
