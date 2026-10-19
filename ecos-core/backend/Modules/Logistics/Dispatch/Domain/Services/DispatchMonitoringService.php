<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Logistics\Dispatch\Domain\Enums\AllocationStatus;
use Modules\Logistics\Dispatch\Domain\Enums\ConflictStatus;
use Modules\Logistics\Dispatch\Domain\Enums\DispatchSessionStatus;
use Modules\Logistics\Dispatch\Domain\Enums\LockStatus;
use Modules\Logistics\Dispatch\Domain\Enums\QueueItemStatus;
use Modules\Logistics\Dispatch\Domain\Enums\ReviewStatus;
use Modules\Logistics\Dispatch\Domain\Models\AssignmentLock;
use Modules\Logistics\Dispatch\Domain\Models\AssignmentReview;
use Modules\Logistics\Dispatch\Domain\Models\DispatchConflict;
use Modules\Logistics\Dispatch\Domain\Models\DispatchQueueItem;
use Modules\Logistics\Dispatch\Domain\Models\DispatchSession;
use Modules\Logistics\Dispatch\Domain\Models\ResourceAllocation;

/**
 * Operational metrics. NO PREDICTION — these are counts and rates over facts
 * that already happened.
 *
 * Two rules run through every figure here:
 *
 *   • A rate computed from no data is NULL, never zero. "0% success" and "no
 *     data yet" are different statements, and conflating them produces
 *     confidently wrong dashboards.
 *   • Nothing is projected or forecast. Phase 3 is monitoring; anything
 *     predictive is out of scope.
 */
class DispatchMonitoringService
{
    /**
     * The headline board — what an operations manager checks first.
     *
     * @return array<string, mixed>
     */
    public function kpis(?string $companyId = null, ?Carbon $from = null, ?Carbon $to = null): array
    {
        $from ??= Carbon::today();
        $to ??= Carbon::now();

        $scoped = fn ($query) => $query->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId));

        $sessions = $scoped(DispatchSession::query())
            ->whereBetween('started_at', [$from, $to])
            ->get();

        $allocations = $scoped(ResourceAllocation::query())
            ->whereBetween('allocated_at', [$from, $to])
            ->get();

        $confirmed = $allocations->where('status', AllocationStatus::Confirmed)->count();
        $failed = $allocations->where('status', AllocationStatus::Failed)->count();
        $attempted = $allocations->count();

        $automatic = $allocations->where('allocation_mode', ResourceAllocation::MODE_AUTOMATIC)->count();

        $durations = $sessions
            ->map(static fn (DispatchSession $s) => $s->durationMinutes())
            ->filter(static fn (?int $d) => $d !== null && $d > 0);

        return [
            'from' => $from->toIso8601String(),
            'to' => $to->toIso8601String(),

            'sessions_opened' => $sessions->count(),
            'sessions_active' => $sessions->where('status', DispatchSessionStatus::Open)->count(),
            'sessions_abandoned' => $sessions->where('status', DispatchSessionStatus::Abandoned)->count(),

            'allocations_attempted' => $attempted,
            'allocations_confirmed' => $confirmed,
            'allocations_failed' => $failed,
            // Null, not zero, when nothing was attempted.
            'confirmation_rate' => $attempted > 0 ? round($confirmed / $attempted, 4) : null,
            'automatic_share' => $attempted > 0 ? round($automatic / $attempted, 4) : null,

            'total_assigned' => (int) $sessions->sum('assigned_count'),
            'total_released' => (int) $sessions->sum('released_count'),

            // Cycle time: how long a dispatcher's window actually runs.
            'avg_session_minutes' => $durations->isEmpty() ? null : (int) round($durations->avg()),
        ];
    }

    /**
     * Queue statistics — depth, ageing and what is stuck.
     *
     * @return array<string, mixed>
     */
    public function queueStatistics(?string $companyId = null, ?int $boardId = null): array
    {
        $items = DispatchQueueItem::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->when($boardId !== null, fn ($q) => $q->where('dispatch_board_id', $boardId))
            ->whereNotIn('status', [
                QueueItemStatus::Completed->value,
                QueueItemStatus::Cancelled->value,
            ])
            ->get();

        $byStatus = [];
        foreach (QueueItemStatus::cases() as $status) {
            $byStatus[$status->value] = $items->where('status', $status)->count();
        }

        $waiting = $items->whereIn('status', [QueueItemStatus::Waiting, QueueItemStatus::Blocked]);
        $waits = $waiting->map(static fn (DispatchQueueItem $i) => $i->waitingMinutes());

        return [
            'depth' => $items->count(),
            'by_status' => $byStatus,
            'needs_action' => $waiting->count(),
            // An item that keeps failing needs a human, not another retry.
            'stuck' => $items->filter(static fn (DispatchQueueItem $i) => $i->isStuck())->count(),
            'avg_wait_minutes' => $waits->isEmpty() ? null : (int) round($waits->avg()),
            'oldest_wait_minutes' => $waits->isEmpty() ? null : (int) $waits->max(),
            'by_priority' => [
                'critical' => $items->where('priority.value', 'critical')->count(),
                'high' => $items->where('priority.value', 'high')->count(),
                'normal' => $items->where('priority.value', 'normal')->count(),
                'low' => $items->where('priority.value', 'low')->count(),
            ],
        ];
    }

    /**
     * Assignment health — what is blocked, waiting on a human, or contended.
     *
     * @return array<string, mixed>
     */
    public function assignmentHealth(?string $companyId = null): array
    {
        $conflicts = DispatchConflict::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->whereIn('status', [ConflictStatus::Open->value, ConflictStatus::Acknowledged->value])
            ->get();

        $byType = [];
        foreach ($conflicts as $conflict) {
            $key = $conflict->conflict_type->value;
            $byType[$key] = ($byType[$key] ?? 0) + 1;
        }

        // Which module owns the outstanding problems — where the work actually
        // has to happen.
        $byAuthority = [];
        foreach ($conflicts as $conflict) {
            $key = $conflict->authority();
            $byAuthority[$key] = ($byAuthority[$key] ?? 0) + 1;
        }

        $pendingReviews = AssignmentReview::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->where('status', ReviewStatus::Pending->value)
            ->get();

        $reviewWaits = $pendingReviews->map(static fn (AssignmentReview $r) => $r->waitingMinutes());

        return [
            'open_conflicts' => $conflicts->count(),
            'blocking_conflicts' => $conflicts
                ->filter(static fn (DispatchConflict $c) => $c->conflict_type->isBlocking())
                ->count(),
            'conflicts_by_type' => $byType,
            'conflicts_by_authority' => $byAuthority,
            'oldest_conflict_minutes' => $conflicts->isEmpty()
                ? null
                : (int) $conflicts->map(static fn (DispatchConflict $c) => $c->ageMinutes())->max(),

            'pending_reviews' => $pendingReviews->count(),
            'oldest_review_minutes' => $reviewWaits->isEmpty() ? null : (int) $reviewWaits->max(),

            'held_locks' => AssignmentLock::query()
                ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
                ->where('status', LockStatus::Held->value)
                ->count(),
        ];
    }

    /**
     * Capacity utilisation.
     *
     * ┌─ DIRECTIVE 4/11 — READS NETWORK, COMPUTES NOTHING ──────────────────┐
     * │ The utilisation figures come from CapacitySlot's own accessors.      │
     * │ Dispatch performs no capacity arithmetic — Network owns it.          │
     * └──────────────────────────────────────────────────────────────────────┘
     *
     * @return array<string, mixed>
     */
    public function capacityUtilisation(?string $companyId = null, ?Carbon $date = null): array
    {
        $date ??= Carbon::today();

        $slots = \Modules\Logistics\Network\Domain\Models\CapacitySlot::query()
            ->whereHas('plan', function ($q) use ($companyId, $date) {
                $q->whereDate('plan_date', $date->toDateString())
                    ->when($companyId !== null, fn ($inner) => $inner->where('company_id', $companyId));
            })
            ->with('plan.area')
            ->get();

        $utilisations = $slots
            ->map(static fn ($slot) => $slot->utilisation())
            ->filter(static fn (?float $u) => $u !== null);

        return [
            'date' => $date->toDateString(),
            'slot_count' => $slots->count(),
            'avg_utilisation' => $utilisations->isEmpty() ? null : round($utilisations->avg(), 4),
            'at_warn_threshold' => $slots->filter(static fn ($s) => $s->isAtWarnThreshold())->count(),
            'exhausted' => $slots->filter(static fn ($s) => $s->isExhausted())->count(),
            'by_area' => $slots
                ->groupBy(static fn ($slot) => $slot->plan?->area?->name ?? 'Unassigned')
                ->map(static fn ($group) => [
                    'slots' => $group->count(),
                    'exhausted' => $group->filter(static fn ($s) => $s->isExhausted())->count(),
                    'binding_units' => $group
                        ->map(static fn ($s) => $s->bindingUnit()?->value)
                        ->filter()
                        ->unique()
                        ->values()
                        ->all(),
                ])
                ->all(),
        ];
    }

    /**
     * The exception dashboard — everything needing a human, in one place.
     *
     * @return array<string, mixed>
     */
    public function exceptions(?string $companyId = null): array
    {
        $health = $this->assignmentHealth($companyId);
        $queue = $this->queueStatistics($companyId);

        return [
            'blocking_conflicts' => $health['blocking_conflicts'],
            'pending_reviews' => $health['pending_reviews'],
            'blocked_queue_items' => $queue['by_status'][QueueItemStatus::Blocked->value] ?? 0,
            'stuck_queue_items' => $queue['stuck'],
            'abandoned_sessions' => DispatchSession::query()
                ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
                ->where('status', DispatchSessionStatus::Abandoned->value)
                ->whereDate('ended_at', Carbon::today())
                ->count(),
            'conflicts_by_authority' => $health['conflicts_by_authority'],
            'oldest_conflict_minutes' => $health['oldest_conflict_minutes'],
            'oldest_review_minutes' => $health['oldest_review_minutes'],
        ];
    }
}
