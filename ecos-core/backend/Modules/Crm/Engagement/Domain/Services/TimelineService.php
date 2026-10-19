<?php

declare(strict_types=1);

namespace Modules\Crm\Engagement\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Crm\Engagement\Domain\Contracts\TimelineSource;
use Modules\Crm\Engagement\Domain\Models\CustomerActivity;
use Modules\Crm\Engagement\Domain\ValueObjects\TimelineEntry;

/**
 * The Customer Timeline — one append-only, source-agnostic feed.
 *
 * ┌─ CRM ACTIVITIES + LIVE READS FROM EXISTING SYSTEMS ─────────────────────┐
 * │ Merges the CRM's own append-only activities with entries READ live from    │
 * │ every registered source (conversations, orders, notes). Nothing is copied   │
 * │ or stored here; the timeline is computed on read and sorted by time. Every  │
 * │ interaction the business had with the customer appears exactly once.        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class TimelineService
{
    /** @param list<TimelineSource> $sources */
    public function __construct(private readonly array $sources) {}

    /**
     * The full, sorted timeline.
     *
     * @param  array<string, mixed>  $filters  from, to, type, source, channel, limit, offset
     * @return array<string, mixed>
     */
    public function timeline(string $companyId, string $customerId, array $filters = []): array
    {
        $entries = $this->filter($this->collect($companyId, $customerId, $filters), $filters);

        $limit = (int) ($filters['limit'] ?? 50);
        $offset = (int) ($filters['offset'] ?? 0);
        $total = count($entries);
        $page = array_slice($entries, $offset, $limit);

        return [
            'entries' => array_map(static fn (TimelineEntry $e) => $e->toArray(), $page),
            'total' => $total,
            'returned' => count($page),
        ];
    }

    /** Interaction history — the timeline without internal system events. */
    public function interactions(string $companyId, string $customerId, array $filters = []): array
    {
        $filters['only_interactions'] = true;

        return $this->timeline($companyId, $customerId, $filters);
    }

    /**
     * The omnichannel activity feed — the timeline plus a per-channel/source
     * breakdown of what the customer engaged through.
     *
     * @return array<string, mixed>
     */
    public function feed(string $companyId, string $customerId, array $filters = []): array
    {
        $all = $this->collect($companyId, $customerId, $filters);

        $byChannel = [];
        $bySource = [];
        foreach ($all as $e) {
            $byChannel[$e->channel ?? 'other'] = ($byChannel[$e->channel ?? 'other'] ?? 0) + 1;
            $bySource[$e->source] = ($bySource[$e->source] ?? 0) + 1;
        }

        return array_merge($this->timeline($companyId, $customerId, $filters), [
            'channels' => $byChannel,
            'sources' => $bySource,
        ]);
    }

    /**
     * The merged, time-sorted entries (no paging/filtering beyond the window).
     *
     * @return list<TimelineEntry>
     */
    public function collect(string $companyId, string $customerId, array $filters = []): array
    {
        $from = isset($filters['from']) ? Carbon::parse($filters['from']) : null;
        $to = isset($filters['to']) ? Carbon::parse($filters['to']) : null;

        $entries = $this->crmActivities($companyId, $customerId, $from, $to);

        foreach ($this->sources as $source) {
            foreach ($source->entries($companyId, $customerId, $from, $to) as $entry) {
                $entries[] = $entry;
            }
        }

        usort($entries, static fn (TimelineEntry $a, TimelineEntry $b) => $b->occurredAt->getTimestamp() <=> $a->occurredAt->getTimestamp());

        return $entries;
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /** @return list<TimelineEntry> */
    private function crmActivities(string $companyId, string $customerId, ?Carbon $from, ?Carbon $to): array
    {
        return CustomerActivity::query()
            ->where('company_id', $companyId)
            ->where('customer_id', $customerId)
            ->when($from !== null, fn ($q) => $q->where('occurred_at', '>=', $from))
            ->when($to !== null, fn ($q) => $q->where('occurred_at', '<=', $to))
            ->orderByDesc('occurred_at')
            ->limit(1000)
            ->get()
            ->map(fn (CustomerActivity $a): TimelineEntry => new TimelineEntry(
                source: 'crm',
                type: $a->activity_type->value,
                title: $a->subject ?? ucfirst($a->activity_type->value),
                occurredAt: $a->occurred_at,
                channel: $a->channel,
                direction: $a->direction?->value,
                body: $a->body,
                refType: $a->related_type,
                refId: $a->related_id,
                actorId: $a->actor_id !== null ? (int) $a->actor_id : null,
                meta: $a->metadata ?? [],
            ))->all();
    }

    /**
     * @param  list<TimelineEntry>  $entries
     * @param  array<string, mixed>  $filters
     * @return list<TimelineEntry>
     */
    private function filter(array $entries, array $filters): array
    {
        return array_values(array_filter($entries, static function (TimelineEntry $e) use ($filters): bool {
            if (($filters['only_interactions'] ?? false) && ! $e->isInteraction()) {
                return false;
            }
            if (! empty($filters['type']) && $e->type !== $filters['type']) {
                return false;
            }
            if (! empty($filters['source']) && $e->source !== $filters['source']) {
                return false;
            }
            if (! empty($filters['channel']) && $e->channel !== $filters['channel']) {
                return false;
            }

            return true;
        }));
    }
}
