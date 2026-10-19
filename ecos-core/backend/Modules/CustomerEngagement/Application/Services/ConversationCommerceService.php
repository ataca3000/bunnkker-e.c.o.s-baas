<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\Services;

use Illuminate\Support\Facades\DB;
use Modules\CustomerEngagement\Domain\Enums\ConversationIntent;
use Modules\CustomerEngagement\Domain\Models\Conversation;

class ConversationCommerceService
{
    /**
     * Link a commerce entity (order|quote|lead|invoice) to the conversation.
     */
    public function linkEntity(
        Conversation $conversation,
        string $entityType,
        string $entityId,
        string $entityCode,
        int $userId,
    ): void {
        DB::table('cep_conversation_orders')->insert([
            'id' => \Illuminate\Support\Str::uuid()->toString(),
            'conversation_id' => $conversation->id,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'entity_code' => $entityCode,
            'created_by' => $userId,
            'created_at' => now(),
        ]);

        // Update conversation intent based on entity type
        $intent = match ($entityType) {
            'order' => ConversationIntent::ORDER->value,
            'quote' => ConversationIntent::QUOTE->value,
            'lead' => ConversationIntent::LEAD->value,
            default => null,
        };

        if ($intent) {
            $updates = ['intent' => $intent];
            if ($entityType === 'order') {
                $updates['order_id'] = $entityId;
                $updates['last_order_at'] = now();
            }
            if ($entityType === 'quote') {
                $updates['quote_id'] = $entityId;
            }
            $conversation->update($updates);
        }
    }

    public function getLinkedEntities(Conversation $conversation): array
    {
        return DB::table('cep_conversation_orders')
            ->where('conversation_id', $conversation->id)
            ->orderByDesc('created_at')
            ->get()
            ->toArray();
    }

    public function getConversationKpis(string $companyId): array
    {
        $base = DB::table('cep_conversations')->where('company_id', $companyId);

        return [
            'total' => (clone $base)->count(),
            'open' => (clone $base)->where('status', 'open')->count(),
            'assigned' => (clone $base)->where('status', 'assigned')->count(),
            'waiting_agent' => (clone $base)->where('status', 'waiting_agent')->count(),
            'resolved_today' => (clone $base)->where('status', 'resolved')->whereDate('closed_at', today())->count(),
            'orders_created' => DB::table('cep_conversation_orders')->where('entity_type', 'order')
                ->whereIn('conversation_id', (clone $base)->pluck('id'))->count(),
        ];
    }
}
