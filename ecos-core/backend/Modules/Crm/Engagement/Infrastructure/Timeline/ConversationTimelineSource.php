<?php

declare(strict_types=1);

namespace Modules\Crm\Engagement\Infrastructure\Timeline;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Crm\Engagement\Domain\Contracts\TimelineSource;
use Modules\Crm\Engagement\Domain\ValueObjects\TimelineEntry;
use Throwable;

/**
 * Reads omnichannel conversations (WhatsApp / Messenger / Instagram …) from the
 * existing CustomerEngagement inbox (`cep_conversations`) into the timeline.
 *
 * It reads the table directly — no import of the CustomerEngagement module — so
 * the CRM depends on none of its code and never copies a conversation. If the
 * inbox is not installed, it contributes nothing.
 */
final class ConversationTimelineSource implements TimelineSource
{
    public function key(): string
    {
        return 'customer_engagement';
    }

    public function entries(string $companyId, string $customerId, ?Carbon $from = null, ?Carbon $to = null): array
    {
        if (! Schema::hasTable('cep_conversations')) {
            return [];
        }

        try {
            $rows = DB::table('cep_conversations')
                ->where('customer_id', $customerId)
                ->when(Schema::hasColumn('cep_conversations', 'company_id'), fn ($q) => $q->where('company_id', $companyId))
                ->when($from !== null, fn ($q) => $q->where('started_at', '>=', $from))
                ->when($to !== null, fn ($q) => $q->where('started_at', '<=', $to))
                ->orderByDesc('started_at')
                ->limit(500)
                ->get();
        } catch (Throwable) {
            return [];
        }

        return $rows->map(function ($r): TimelineEntry {
            $provider = $r->provider ?? 'chat';
            $when = $r->started_at ?? $r->last_message_at ?? $r->created_at ?? now();

            return new TimelineEntry(
                source: $this->key(),
                type: 'conversation',
                title: 'Conversation via '.ucfirst((string) $provider).(isset($r->status) ? ' ('.$r->status.')' : ''),
                occurredAt: Carbon::parse($when),
                channel: (string) $provider,
                direction: 'inbound',
                refType: 'cep_conversation',
                refId: (string) $r->id,
                meta: ['status' => $r->status ?? null, 'messages_count' => $r->messages_count ?? null],
            );
        })->all();
    }
}
