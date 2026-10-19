<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\Services;

use Modules\CustomerEngagement\Domain\Models\Conversation;
use Modules\CustomerEngagement\Domain\Models\ConversationAttribution;

class AttributionCaptureService
{
    public function capture(Conversation $conversation, array $attributionData): ConversationAttribution
    {
        $attribution = ConversationAttribution::create([
            'conversation_id' => $conversation->id,
            'source_provider' => $attributionData['source_provider'] ?? 'meta',
            'ad_id' => $attributionData['ad_id'] ?? null,
            'ad_set_id' => $attributionData['ad_set_id'] ?? null,
            'campaign_id_external' => $attributionData['campaign_id'] ?? null,
            'creative_id' => $attributionData['creative_id'] ?? null,
            'click_id' => $attributionData['click_id'] ?? null,
            'ecos_campaign_id' => $attributionData['ecos_campaign_id'] ?? null,
            'ecos_initiative_id' => $attributionData['ecos_initiative_id'] ?? null,
            'business_dna_id' => $attributionData['business_dna_id'] ?? $conversation->business_dna_id,
            'utm_source' => $attributionData['utm_source'] ?? null,
            'utm_medium' => $attributionData['utm_medium'] ?? null,
            'utm_campaign' => $attributionData['utm_campaign'] ?? null,
            'utm_term' => $attributionData['utm_term'] ?? null,
            'utm_content' => $attributionData['utm_content'] ?? null,
            'landing_page' => $attributionData['landing_page'] ?? null,
            'referrer' => $attributionData['referrer'] ?? null,
            'raw_payload' => $attributionData,
        ]);

        $conversation->update(['attribution_captured' => true]);

        return $attribution;
    }

    public function forConversation(string $conversationId): ?ConversationAttribution
    {
        return ConversationAttribution::where('conversation_id', $conversationId)->first();
    }
}
