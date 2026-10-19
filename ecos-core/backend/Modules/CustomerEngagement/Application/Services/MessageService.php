<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\CustomerEngagement\Domain\Enums\MessageDirection;
use Modules\CustomerEngagement\Domain\Enums\MessageType;
use Modules\CustomerEngagement\Domain\Models\Conversation;
use Modules\CustomerEngagement\Domain\Models\Message;

class MessageService
{
    public function __construct(
        private readonly ConversationService $conversationService,
    ) {}

    public function ingestInbound(Conversation $conv, array $data): Message
    {
        $message = Message::create([
            'conversation_id' => $conv->id,
            'external_message_id' => $data['external_message_id'] ?? null,
            'direction' => MessageDirection::Inbound->value,
            'message_type' => $data['message_type'] ?? MessageType::Text->value,
            'content' => $data['content'] ?? null,
            'media_url' => $data['media_url'] ?? null,
            'media_type' => $data['media_type'] ?? null,
            'media_size' => $data['media_size'] ?? null,
            'sender_type' => 'customer',
            'sender_id' => $data['sender_id'] ?? null,
            'sender_name' => $data['sender_name'] ?? $conv->customer_name,
            'metadata' => $data['metadata'] ?? null,
            'sent_at' => $data['sent_at'] ?? now(),
            'created_at' => now(),
        ]);

        $this->conversationService->incrementUnread($conv);

        return $message;
    }

    public function sendOutbound(Conversation $conv, array $data): Message
    {
        $message = Message::create([
            'conversation_id' => $conv->id,
            'direction' => MessageDirection::Outbound->value,
            'message_type' => $data['message_type'] ?? MessageType::Text->value,
            'content' => $data['content'] ?? null,
            'media_url' => $data['media_url'] ?? null,
            'sender_type' => 'agent',
            'sender_id' => $data['sender_id'] ?? null,
            'sender_name' => $data['sender_name'] ?? null,
            'metadata' => $data['metadata'] ?? null,
            'sent_at' => now(),
            'created_at' => now(),
        ]);

        $conv->update([
            'last_message_at' => now(),
            'last_agent_message_at' => now(),
            'status' => 'waiting_customer',
        ]);

        $this->conversationService->markFirstResponse($conv);

        return $message;
    }

    public function markAllRead(Conversation $conv): void
    {
        Message::where('conversation_id', $conv->id)
            ->where('direction', MessageDirection::Inbound->value)
            ->where('is_read', false)
            ->update(['is_read' => true, 'read_at' => now()]);

        $this->conversationService->clearUnread($conv);
    }

    public function getThread(string $conversationId, int $perPage = 50): LengthAwarePaginator
    {
        return Message::where('conversation_id', $conversationId)
            ->where('is_deleted', false)
            ->orderBy('sent_at')
            ->paginate($perPage);
    }
}
