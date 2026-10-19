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
 * Surfaces the customer notes captured by the Customer Foundation (C1,
 * `crm_customer_notes`) on the timeline, so a note logged on the profile also
 * appears in the interaction history without being duplicated.
 */
final class CrmNoteTimelineSource implements TimelineSource
{
    public function key(): string
    {
        return 'crm';
    }

    public function entries(string $companyId, string $customerId, ?Carbon $from = null, ?Carbon $to = null): array
    {
        if (! Schema::hasTable('crm_customer_notes')) {
            return [];
        }

        try {
            $rows = DB::table('crm_customer_notes')
                ->where('customer_id', $customerId)
                ->when($from !== null, fn ($q) => $q->where('created_at', '>=', $from))
                ->when($to !== null, fn ($q) => $q->where('created_at', '<=', $to))
                ->orderByDesc('created_at')
                ->limit(500)
                ->get();
        } catch (Throwable) {
            return [];
        }

        return $rows->map(fn ($r): TimelineEntry => new TimelineEntry(
            source: 'crm',
            type: 'note',
            title: ($r->is_pinned ?? false) ? 'Pinned note' : 'Note',
            occurredAt: Carbon::parse($r->created_at ?? now()),
            channel: 'note',
            direction: 'internal',
            body: (string) ($r->body ?? ''),
            refType: 'crm_customer_note',
            refId: (string) $r->id,
            actorId: isset($r->author_id) ? (int) $r->author_id : null,
        ))->all();
    }
}
