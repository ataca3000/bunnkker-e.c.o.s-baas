<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Services;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Logistics\Dispatch\Domain\Enums\QueueItemStatus;
use Modules\Logistics\Dispatch\Domain\Enums\QueuePriority;
use Modules\Logistics\Dispatch\Domain\Exceptions\DispatchOperationsException;
use Modules\Logistics\Dispatch\Domain\Models\DispatchBoard;
use Modules\Logistics\Dispatch\Domain\Models\DispatchQueueItem;
use Modules\Logistics\Dispatch\Domain\Models\DispatchSession;
use Modules\Logistics\Dispatch\Domain\Models\DispatchTimelineEvent;
use Modules\Logistics\Distribution\Domain\Models\Trip;

/**
 * The dispatch queue.
 *
 * `rank` is DERIVED from priority plus waiting time and recomputed here — never
 * accepted from a caller. If callers could set it, every integration would mark
 * its own trips urgent and the ordering would stop meaning anything.
 *
 * Claiming is transactional and locks the row, so two dispatchers cannot both
 * take the same item.
 */
class DispatchQueueService
{
    public function __construct(
        private readonly DispatchTimelineService $timeline,
    ) {}

    /**
     * Build (or refresh) the queue for a board from trips that still need
     * resources.
     *
     * Distribution owns the trip; this is a READ. Idempotent — re-running adds
     * only what is missing, so a board can be refreshed mid-morning without
     * duplicating work already in progress.
     */
    public function build(DispatchBoard $board, ?int $actorId = null, ?string $actorName = null): int
    {
        $trips = Trip::query()
            ->when($board->company_id !== null, fn ($q) => $q->where('company_id', $board->company_id))
            ->whereNull('driver_vehicle_assignment_id')
            ->whereIn('status', ['planning', 'planned'])
            ->orderBy('id')
            ->get();

        $added = 0;

        DB::transaction(function () use ($board, $trips, &$added) {
            foreach ($trips as $trip) {
                $exists = DispatchQueueItem::query()
                    ->where('dispatch_board_id', $board->id)
                    ->where('trip_id', $trip->id)
                    ->whereNotNull('active_flag')
                    ->exists();

                if ($exists) {
                    continue;
                }

                $priority = $this->derivePriority($trip);

                DispatchQueueItem::create([
                    'dispatch_board_id' => $board->id,
                    'company_id' => $board->company_id,
                    'trip_id' => $trip->id,
                    'status' => QueueItemStatus::Waiting->value,
                    'priority' => $priority->value,
                    'rank' => $priority->baseRank(),
                    'priority_reason' => $this->describePriority($trip, $priority),
                    'queued_at' => Carbon::now(),
                ]);

                $added++;
            }
        });

        $this->reRank($board);

        $this->timeline->record(
            eventType: DispatchTimelineEvent::TYPE_QUEUE_BUILT,
            title: 'Dispatch queue built',
            description: "{$added} trip(s) added to the queue.",
            companyId: $board->company_id,
            boardId: $board->id,
            actorId: $actorId,
            actorName: $actorName,
        );

        return $added;
    }

    /**
     * The queue in working order.
     *
     * @return Collection<int, DispatchQueueItem>
     */
    public function forBoard(DispatchBoard $board, bool $liveOnly = true): Collection
    {
        return DispatchQueueItem::query()
            ->where('dispatch_board_id', $board->id)
            ->when($liveOnly, fn ($q) => $q->whereNotIn('status', [
                QueueItemStatus::Completed->value,
                QueueItemStatus::Cancelled->value,
            ]))
            ->with('trip')
            ->orderBy('rank')
            ->orderBy('queued_at')
            ->get();
    }

    /**
     * Claim the next actionable item.
     *
     * Row-locked: two dispatchers hitting "next" simultaneously must not get
     * the same trip.
     */
    public function claimNext(DispatchSession $session): ?DispatchQueueItem
    {
        if (! $session->isActive()) {
            throw DispatchOperationsException::sessionNotActive($session->status->label());
        }

        return DB::transaction(function () use ($session) {
            $item = DispatchQueueItem::query()
                ->where('dispatch_board_id', $session->dispatch_board_id)
                ->where('status', QueueItemStatus::Waiting->value)
                ->orderBy('rank')
                ->orderBy('queued_at')
                ->lockForUpdate()
                ->first();

            if ($item === null) {
                return null;
            }

            $item->update([
                'status' => QueueItemStatus::Claimed->value,
                'claimed_at' => Carbon::now(),
                'claimed_by_session_id' => $session->id,
            ]);

            return $item->refresh();
        });
    }

    public function claim(DispatchQueueItem $item, DispatchSession $session): DispatchQueueItem
    {
        if (! $session->isActive()) {
            throw DispatchOperationsException::sessionNotActive($session->status->label());
        }

        return DB::transaction(function () use ($item, $session) {
            $locked = DispatchQueueItem::query()->lockForUpdate()->findOrFail($item->id);

            if ($locked->status === QueueItemStatus::Claimed
                && $locked->claimed_by_session_id !== $session->id) {
                throw DispatchOperationsException::queueItemAlreadyClaimed(
                    $locked->claimedBy?->operator_name ?? 'another session'
                );
            }

            $this->assertTransition($locked, QueueItemStatus::Claimed);

            $locked->update([
                'status' => QueueItemStatus::Claimed->value,
                'claimed_at' => Carbon::now(),
                'claimed_by_session_id' => $session->id,
            ]);

            return $locked->refresh();
        });
    }

    /** Hand an item back to the queue. */
    public function release(DispatchQueueItem $item, ?string $failureReason = null): DispatchQueueItem
    {
        $this->assertTransition($item, QueueItemStatus::Waiting);

        $item->update([
            'status' => QueueItemStatus::Waiting->value,
            'claimed_at' => null,
            'claimed_by_session_id' => null,
            'last_failure_reason' => $failureReason,
        ]);

        if ($failureReason !== null) {
            $item->increment('attempt_count');
        }

        return $item->refresh();
    }

    public function markAssigned(DispatchQueueItem $item): DispatchQueueItem
    {
        $this->assertTransition($item, QueueItemStatus::Assigned);

        $item->update(['status' => QueueItemStatus::Assigned->value]);

        return $item->refresh();
    }

    public function markBlocked(DispatchQueueItem $item, string $reason): DispatchQueueItem
    {
        $this->assertTransition($item, QueueItemStatus::Blocked);

        $item->update([
            'status' => QueueItemStatus::Blocked->value,
            'last_failure_reason' => $reason,
        ]);
        $item->increment('attempt_count');

        return $item->refresh();
    }

    public function complete(DispatchQueueItem $item): DispatchQueueItem
    {
        $this->assertTransition($item, QueueItemStatus::Completed);

        $item->update([
            'status' => QueueItemStatus::Completed->value,
            'completed_at' => Carbon::now(),
            // Frees the one-live-item-per-trip slot.
            'active_flag' => null,
        ]);

        return $item->refresh();
    }

    public function defer(DispatchQueueItem $item, ?string $reason = null): DispatchQueueItem
    {
        $this->assertTransition($item, QueueItemStatus::Deferred);

        $item->update([
            'status' => QueueItemStatus::Deferred->value,
            'last_failure_reason' => $reason,
            'claimed_by_session_id' => null,
        ]);

        return $item->refresh();
    }

    /** Change priority. The reason is required so ordering stays explainable. */
    public function prioritise(
        DispatchQueueItem $item,
        QueuePriority $priority,
        string $reason,
    ): DispatchQueueItem {
        // Set the priority BEFORE computing rank. A single update() evaluates
        // its array first, so computeRank() would otherwise read the OLD
        // priority and leave the item ranked where it was.
        $item->priority = $priority;
        $item->priority_reason = $reason;
        $item->rank = $item->computeRank();
        $item->save();

        return $item->refresh();
    }

    /**
     * Recompute rank across a board, applying ageing.
     *
     * Ageing prevents starvation: without it the bottom of the queue never
     * moves, and low-priority trips simply never go out.
     */
    public function reRank(DispatchBoard $board, ?Carbon $at = null): int
    {
        $items = DispatchQueueItem::query()
            ->where('dispatch_board_id', $board->id)
            ->whereIn('status', [QueueItemStatus::Waiting->value, QueueItemStatus::Blocked->value])
            ->get();

        foreach ($items as $item) {
            $item->update(['rank' => $item->computeRank($at)]);
        }

        return $items->count();
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /**
     * Priority from the trip's own facts.
     *
     * Deliberately simple and explainable — a queue whose ordering nobody can
     * account for is one dispatchers work around.
     */
    private function derivePriority(Trip $trip): QueuePriority
    {
        if (($trip->capacity ?? 0) >= 40) {
            return QueuePriority::High;
        }

        return QueuePriority::Normal;
    }

    private function describePriority(Trip $trip, QueuePriority $priority): string
    {
        return match ($priority) {
            QueuePriority::High => 'Large trip ('.($trip->capacity ?? 0).' orders).',
            default => 'Standard priority.',
        };
    }

    private function assertTransition(DispatchQueueItem $item, QueueItemStatus $target): void
    {
        if (! $item->status->canTransitionTo($target)) {
            throw DispatchOperationsException::invalidQueueTransition($item->status, $target);
        }
    }
}
