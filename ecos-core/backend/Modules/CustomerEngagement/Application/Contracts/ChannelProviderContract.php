<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\Contracts;

use Illuminate\Http\Request;

interface ChannelProviderContract
{
    /**
     * Return the channel identifier (whatsapp | messenger | instagram_direct).
     */
    public function channel(): string;

    /**
     * Send a text or media message to a recipient.
     * Returns ['provider_message_id' => '...', 'sent_at' => '...']
     */
    public function sendMessage(string $recipientId, string $text, array $options = []): array;

    /**
     * Send a pre-approved template message.
     */
    public function sendTemplate(string $recipientId, string $templateName, string $languageCode, array $components = []): array;

    /**
     * Send a media attachment (image, document, video, audio).
     * $mediaType: image | document | video | audio
     */
    public function sendMedia(string $recipientId, string $mediaType, string $mediaUrl, ?string $caption = null): array;

    /**
     * Mark a specific message as read (send read receipt).
     */
    public function markAsRead(string $providerMessageId): bool;

    /**
     * Validate the incoming webhook signature/authenticity.
     */
    public function validateWebhook(Request $request, string $webhookSecret): bool;

    /**
     * Parse raw inbound webhook payload into a normalized array.
     * Returns array of:
     * [{
     *   conversation_id: string,       // external thread ID
     *   message_id: string,            // external message ID
     *   sender_id: string,             // external sender ID
     *   sender_name: string|null,
     *   sender_phone: string|null,
     *   message_type: string,          // text|image|video|document|voice_note|...
     *   content: string|null,
     *   media_url: string|null,
     *   media_type: string|null,
     *   reply_to_message_id: string|null,
     *   timestamp: int,                // Unix timestamp
     *   attribution: array|null,       // Meta CTWA attribution if present
     * }]
     */
    public function parseInboundWebhook(array $payload): array;

    /**
     * Verify the webhook endpoint during provider setup (GET challenge).
     * Returns the hub.challenge string on success or null on failure.
     */
    public function handleVerificationChallenge(Request $request, string $verifyToken): ?string;
}
