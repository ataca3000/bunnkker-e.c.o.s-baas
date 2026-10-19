<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Logistics\Dispatch\Domain\Models\DispatchAuditEntry;
use Modules\Logistics\Dispatch\Domain\Models\DispatchTimelineEvent;
use Modules\Logistics\Operations\Domain\Models\ExceptionEscalation;
use Modules\Logistics\Operations\Domain\Models\ExceptionNote;
use Modules\Logistics\Operations\Domain\Models\ReservationAuditEntry;

/**
 * One time-ordered feed across every append-only record the platform already
 * keeps.
 *
 * ┌─ READS, NEVER WRITES ───────────────────────────────────────────────────┐
 * │ There is no ops_activity table and there are no listeners. A timeline     │
 * │ projection would be a copy of five other tables with its own              │
 * │ invalidation problem (ADR-024), and it would add a writer to state those  │
 * │ modules already own. Instead every request unions the source tables at    │
 * │ read time, normalises each row, and merges. The feed can be dropped and   │
 * │ rebuilt because it is never stored.                                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Truncation is never silent. Each source is capped so one noisy table cannot
 * starve the others, and when a cap bites the response says so — a feed that
 * quietly drops rows reads as "nothing else happened", which is a lie.
 */
class ActivityTimelineService
{
    /** Per-source ceiling before the merge. Keeps one loud table from crowding. */
    private const SOURCE_CAP = 200;

    public const SOURCE_DISPATCH_TIMELINE = 'dispatch_timeline';

    public const SOURCE_DISPATCH_AUDIT = 'dispatch_audit';

    public const SOURCE_CAPACITY_AUDIT = 'capacity_audit';

    public const SOURCE_ESCALATION = 'escalation';

    public const SOURCE_NOTE = 'note';

    /**
     * @param  array<string, mixed>  $filters  company_id, from, to, source, severity, limit
     * @return array<string, mixed>
     */
    public function feed(array $filters = []): array
    {
        $companyId = $filters['company_id'] ?? null;
        $from = isset($filters['from']) ? Carbon::parse($filters['from']) : Carbon::now()->subDay();
        $to = isset($filters['to']) ? Carbon::parse($filters['to']) : Carbon::now();
        $source = $filters['source'] ?? null;
        $severity = $filters['severity'] ?? null;
        $limit = max(1, min((int) ($filters['limit'] ?? 100), 500));

        $wanted = static fn (string $s): bool => $source === null || $source === $s;

        /** @var list<array<string, mixed>> $items */
        $items = [];
        $capped = [];

        if ($wanted(self::SOURCE_DISPATCH_TIMELINE)) {
            [$rows, $hit] = $this->dispatchTimeline($companyId, $from, $to);
            $items = array_merge($items, $rows);
            $capped[self::SOURCE_DISPATCH_TIMELINE] = $hit;
        }

        if ($wanted(self::SOURCE_DISPATCH_AUDIT)) {
            [$rows, $hit] = $this->dispatchAudit($companyId, $from, $to);
            $items = array_merge($items, $rows);
            $capped[self::SOURCE_DISPATCH_AUDIT] = $hit;
        }

        if ($wanted(self::SOURCE_CAPACITY_AUDIT)) {
            [$rows, $hit] = $this->capacityAudit($companyId, $from, $to);
            $items = array_merge($items, $rows);
            $capped[self::SOURCE_CAPACITY_AUDIT] = $hit;
        }

        if ($wanted(self::SOURCE_ESCALATION)) {
            [$rows, $hit] = $this->escalations($companyId, $from, $to);
            $items = array_merge($items, $rows);
            $capped[self::SOURCE_ESCALATION] = $hit;
        }

        if ($wanted(self::SOURCE_NOTE)) {
            [$rows, $hit] = $this->notes($companyId, $from, $to);
            $items = array_merge($items, $rows);
            $capped[self::SOURCE_NOTE] = $hit;
        }

        if ($severity !== null) {
            $items = array_values(array_filter(
                $items,
                static fn (array $i) => $i['severity'] === $severity,
            ));
        }

        // Newest first. usort is stable enough here because each row carries a
        // unique id as the tiebreak.
        usort($items, static function (array $a, array $b) {
            return [$b['occurred_at'], $b['id']] <=> [$a['occurred_at'], $a['id']];
        });

        $shown = array_slice($items, 0, $limit);

        return [
            'from' => $from->toIso8601String(),
            'to' => $to->toIso8601String(),
            'items' => $shown,
            'returned' => count($shown),
            'available' => count($items),
            // Honest about what was dropped, per source.
            'truncated_sources' => array_keys(array_filter($capped)),
            'window_truncated' => count($items) > $limit,
        ];
    }

    // ── Source queries ────────────────────────────────────────────────────────

    /** @return array{0: list<array<string, mixed>>, 1: bool} */
    private function dispatchTimeline(?string $companyId, Carbon $from, Carbon $to): array
    {
        $rows = DispatchTimelineEvent::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->whereBetween('occurred_at', [$from, $to])
            ->latest('occurred_at')
            ->limit(self::SOURCE_CAP + 1)
            ->get();

        $hit = $rows->count() > self::SOURCE_CAP;

        return [
            $rows->take(self::SOURCE_CAP)->map(fn (DispatchTimelineEvent $e) => [
                'id' => self::SOURCE_DISPATCH_TIMELINE.':'.$e->id,
                'source' => self::SOURCE_DISPATCH_TIMELINE,
                'category' => 'dispatch',
                'action' => $e->event_type,
                'title' => $e->title,
                'description' => $e->description,
                'severity' => $e->severity ?? 'info',
                'occurred_at' => $e->occurred_at?->toIso8601String(),
                'actor_name' => $e->actor_name,
                'entity_type' => 'dispatch_board',
                'entity_id' => $e->dispatch_board_id === null ? null : (string) $e->dispatch_board_id,
            ])->all(),
            $hit,
        ];
    }

    /** @return array{0: list<array<string, mixed>>, 1: bool} */
    private function dispatchAudit(?string $companyId, Carbon $from, Carbon $to): array
    {
        $rows = DispatchAuditEntry::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->whereBetween('performed_at', [$from, $to])
            ->latest('performed_at')
            ->limit(self::SOURCE_CAP + 1)
            ->get();

        $hit = $rows->count() > self::SOURCE_CAP;

        return [
            $rows->take(self::SOURCE_CAP)->map(fn (DispatchAuditEntry $e) => [
                'id' => self::SOURCE_DISPATCH_AUDIT.':'.$e->id,
                'source' => self::SOURCE_DISPATCH_AUDIT,
                'category' => 'dispatch',
                'action' => $e->action,
                'title' => $this->humanise($e->action),
                'description' => $e->reason,
                // An override is the audit row worth surfacing loudest.
                'severity' => str_contains($e->action, 'override') ? 'warning' : 'info',
                'occurred_at' => $e->performed_at?->toIso8601String(),
                'actor_name' => $e->actor_name,
                'entity_type' => $e->entity_type,
                'entity_id' => $e->entity_id,
            ])->all(),
            $hit,
        ];
    }

    /** @return array{0: list<array<string, mixed>>, 1: bool} */
    private function capacityAudit(?string $companyId, Carbon $from, Carbon $to): array
    {
        $rows = ReservationAuditEntry::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->whereBetween('performed_at', [$from, $to])
            ->latest('performed_at')
            ->limit(self::SOURCE_CAP + 1)
            ->get();

        $hit = $rows->count() > self::SOURCE_CAP;

        return [
            $rows->take(self::SOURCE_CAP)->map(fn (ReservationAuditEntry $e) => [
                'id' => self::SOURCE_CAPACITY_AUDIT.':'.$e->id,
                'source' => self::SOURCE_CAPACITY_AUDIT,
                'category' => 'capacity',
                'action' => $e->action,
                'title' => 'Capacity '.$e->action,
                'description' => $e->outcome ?? $e->reason,
                // A refused reservation is the one an operator wants to see.
                'severity' => $e->action === ReservationAuditEntry::ACTION_FAILED ? 'warning' : 'info',
                'occurred_at' => $e->performed_at?->toIso8601String(),
                'actor_name' => $e->actor_name,
                'entity_type' => 'capacity_reservation',
                'entity_id' => (string) $e->capacity_reservation_id,
            ])->all(),
            $hit,
        ];
    }

    /** @return array{0: list<array<string, mixed>>, 1: bool} */
    private function escalations(?string $companyId, Carbon $from, Carbon $to): array
    {
        $rows = ExceptionEscalation::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->whereBetween('escalated_at', [$from, $to])
            ->latest('escalated_at')
            ->limit(self::SOURCE_CAP + 1)
            ->get();

        $hit = $rows->count() > self::SOURCE_CAP;

        return [
            $rows->take(self::SOURCE_CAP)->map(fn (ExceptionEscalation $e) => [
                'id' => self::SOURCE_ESCALATION.':'.$e->id,
                'source' => self::SOURCE_ESCALATION,
                'category' => 'exception',
                'action' => 'escalated',
                'title' => "Escalated to level {$e->level}",
                'description' => $e->reason,
                'severity' => 'warning',
                'occurred_at' => $e->escalated_at?->toIso8601String(),
                'actor_name' => $e->escalated_by_name,
                'entity_type' => 'exception',
                'entity_id' => (string) $e->exception_id,
            ])->all(),
            $hit,
        ];
    }

    /** @return array{0: list<array<string, mixed>>, 1: bool} */
    private function notes(?string $companyId, Carbon $from, Carbon $to): array
    {
        $rows = ExceptionNote::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->whereBetween('written_at', [$from, $to])
            ->latest('written_at')
            ->limit(self::SOURCE_CAP + 1)
            ->get();

        $hit = $rows->count() > self::SOURCE_CAP;

        return [
            $rows->take(self::SOURCE_CAP)->map(fn (ExceptionNote $e) => [
                'id' => self::SOURCE_NOTE.':'.$e->id,
                'source' => self::SOURCE_NOTE,
                'category' => 'exception',
                'action' => $e->note_type,
                'title' => $e->note_type === ExceptionNote::TYPE_HANDOVER ? 'Handover note' : 'Note added',
                'description' => $e->body,
                'severity' => 'info',
                'occurred_at' => $e->written_at?->toIso8601String(),
                'actor_name' => $e->author_name,
                'entity_type' => 'exception',
                'entity_id' => (string) $e->exception_id,
            ])->all(),
            $hit,
        ];
    }

    private function humanise(string $action): string
    {
        return ucfirst(str_replace('_', ' ', $action));
    }
}
