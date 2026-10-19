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
 * Reads a customer's orders from Commerce (`orders`) into the timeline — the
 * commercial thread of the relationship. Reads the table directly (no Commerce
 * import), presenting each order as an entry; the order data is never copied.
 */
final class OrderTimelineSource implements TimelineSource
{
    public function key(): string
    {
        return 'commerce';
    }

    public function entries(string $companyId, string $customerId, ?Carbon $from = null, ?Carbon $to = null): array
    {
        if (! Schema::hasTable('orders')) {
            return [];
        }

        try {
            $rows = DB::table('orders')
                ->where('customer_id', $customerId)
                ->when($from !== null, fn ($q) => $q->where('order_date', '>=', $from))
                ->when($to !== null, fn ($q) => $q->where('order_date', '<=', $to))
                ->orderByDesc('order_date')
                ->limit(500)
                ->get();
        } catch (Throwable) {
            return [];
        }

        return $rows->map(function ($r): TimelineEntry {
            $when = $r->order_date ?? $r->created_at ?? now();

            return new TimelineEntry(
                source: $this->key(),
                type: 'order',
                title: 'Order '.($r->order_number ?? $r->id).(isset($r->status) ? ' — '.$r->status : ''),
                occurredAt: Carbon::parse($when),
                channel: 'commerce',
                direction: 'inbound',
                body: isset($r->total) ? 'Total '.$r->total : null,
                refType: 'order',
                refId: (string) $r->id,
                meta: ['status' => $r->status ?? null, 'total' => $r->total ?? null],
            );
        })->all();
    }
}
