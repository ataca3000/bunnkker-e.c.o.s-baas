<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\Actions;

use Modules\CustomerEngagement\Application\Services\ConversationService;
use Modules\CustomerEngagement\Application\Services\MessageService;
use Modules\CustomerEngagement\Domain\Models\Conversation;
use Modules\CustomerEngagement\Domain\Models\Message;

class IngestMessageAction
{
    public function __construct(
        private readonly ConversationService $conversationService,
        private readonly MessageService $messageService,
    ) {}

    /**
     * Ingest an inbound message from a provider webhook.
     * Creates a conversation if none exists for the external_conversation_id + provider.
     */
    public function execute(array $payload): Message
    {
        $conv = $this->resolveConversation($payload);

        return $this->messageService->ingestInbound($conv, $payload);
    }

    private function resolveConversation(array $payload): Conversation
    {
        if (! empty($payload['conversation_id'])) {
            return $this->conversationService->find($payload['conversation_id']);
        }

        // Find by external identifier
        $existing = Conversation::where('provider', $payload['provider'])
            ->where('external_conversation_id', $payload['external_conversation_id'])
            ->first();

        if ($existing) {
            return $existing;
        }

        // Auto-create conversation for new inbound
        return $this->conversationService->create([
            'provider' => $payload['provider'],
            'external_conversation_id' => $payload['external_conversation_id'] ?? null,
            'customer_name' => $payload['sender_name'] ?? null,
            'customer_phone' => $payload['customer_phone'] ?? null,
            'company_id' => $payload['company_id'] ?? null,
            'brand_id' => $payload['brand_id'] ?? null,
        ]);
    }
}
