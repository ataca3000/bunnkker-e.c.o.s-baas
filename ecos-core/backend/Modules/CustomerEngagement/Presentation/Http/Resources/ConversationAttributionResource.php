<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class ConversationAttributionResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'conversation_id' => $this->conversation_id,
            'source_provider' => $this->source_provider,
            'ad_id' => $this->ad_id,
            'ad_set_id' => $this->ad_set_id,
            'campaign_id_external' => $this->campaign_id_external,
            'click_id' => $this->click_id,
            'ecos_campaign_id' => $this->ecos_campaign_id,
            'ecos_initiative_id' => $this->ecos_initiative_id,
            'utm_source' => $this->utm_source,
            'utm_medium' => $this->utm_medium,
            'utm_campaign' => $this->utm_campaign,
            'landing_page' => $this->landing_page,
            'captured_at' => $this->captured_at?->toIso8601String(),
        ];
    }
}
