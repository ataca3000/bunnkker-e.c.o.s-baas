<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\Services;

use Modules\CustomerEngagement\Domain\Enums\MessageDeliveryStatus;
use Modules\CustomerEngagement\Domain\Models\Conversation;
use Modules\CustomerEngagement\Domain\Models\Message;
use RuntimeException;
use Throwable;

class OutboundMessageService
{
    public function __construct(
        private readonly ChannelProviderService $providerService,
        private readonly ConversationService $conversationService,
    ) {}

    public function send(Conversation $conversation, int $agentId, array $data): Message
    {
        $messageType = $data['message_type'] ?? 'text';

        // Persist as pending first (immutable record)
        $message = Message::create([
            'conversation_id' => $conversation->id,
            'direction' => 'outbound',
            'message_type' => $messageType,
            'content' => $data['content'] ?? null,
            'media_url' => $data['media_url'] ?? null,
            'media_type' => $data['media_type'] ?? null,
            'sender_type' => 'agent',
            'sender_id' => (string) $agentId,
            'reply_to_message_id' => $data['reply_to_message_id'] ?? null,
            'template_name' => $data['template_name'] ?? null,
            'template_params' => $data['template_params'] ?? null,
            'delivery_status' => MessageDeliveryStatus::PENDING->value,
            'sent_at' => now(),
        ]);

        // Dispatch via provider
        try {
            $config = $this->providerService->findByChannel($conversation->provider, $conversation->company_id);

            if (! $config) {
                throw new RuntimeException("No active provider config for channel: {$conversation->provider}");
            }

            $provider = $this->providerService->makeProvider($config);
            $recipientId = $conversation->customer_phone ?? $conversation->external_conversation_id;

            $result = match ($messageType) {
                'template' => $provider->sendTemplate(
                    $recipientId,
                    $data['template_name'],
                    $data['language_code'] ?? 'en',
                    $data['template_params'] ?? [],
                ),
                'image', 'video', 'document', 'audio' => $provider->sendMedia(
                    $recipientId,
                    $messageType,
                    $data['media_url'],
                    $data['content'] ?? null,
                ),
                default => $provider->sendMessage(
                    $recipientId,
                    $data['content'] ?? '',
                    array_filter(['reply_to_message_id' => $data['reply_to_message_id'] ?? null]),
                ),
            };

            $message->update([
                'external_message_id' => $result['provider_message_id'],
                'delivery_status' => MessageDeliveryStatus::SENT->value,
            ]);

            // Mark first response if applicable
            $this->conversationService->markFirstResponse($conversation);
            $conversation->increment('messages_count');
            $conversation->update(['last_message_at' => now(), 'last_agent_message_at' => now()]);
        } catch (Throwable $e) {
            $message->update([
                'delivery_status' => MessageDeliveryStatus::FAILED->value,
                'provider_error' => $e->getMessage(),
                'failed_at' => now(),
            ]);
        }

        return $message->fresh();
    }
}
