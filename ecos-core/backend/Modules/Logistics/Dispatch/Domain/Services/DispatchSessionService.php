<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Logistics\Dispatch\Domain\Enums\DispatchSessionStatus;
use Modules\Logistics\Dispatch\Domain\Exceptions\DispatchOperationsException;
use Modules\Logistics\Dispatch\Domain\Models\DispatchAuditEntry;
use Modules\Logistics\Dispatch\Domain\Models\DispatchBoard;
use Modules\Logistics\Dispatch\Domain\Models\DispatchSession;
use Modules\Logistics\Dispatch\Domain\Models\DispatchTimelineEvent;

/**
 * Dispatch sessions — a dispatcher's working window over a board.
 *
 * Ending a session ALWAYS releases its locks. That is the difference between a
 * lock system that self-heals and one where a closed laptop quietly removes a
 * vehicle from the pool for the rest of the day.
 */
class DispatchSessionService
{
    public function __construct(
        private readonly AssignmentLockService $locks,
        private readonly DispatchTimelineService $timeline,
        private readonly DispatchAuditService $audit,
    ) {}

    public function open(
        DispatchBoard $board,
        string $mode = DispatchSession::MODE_MANUAL,
        ?int $operatorId = null,
        ?string $operatorName = null,
    ): DispatchSession {
        // One open session per operator per board — two would split the audit
        // trail and make "who was dispatching" ambiguous.
        $existing = DispatchSession::query()
            ->where('dispatch_board_id', $board->id)
            ->where('operator_id', $operatorId)
            ->whereIn('status', [
                DispatchSessionStatus::Open->value,
                DispatchSessionStatus::Paused->value,
            ])
            ->exists();

        if ($existing && $operatorId !== null) {
            throw DispatchOperationsException::sessionAlreadyOpen($operatorName ?? 'That operator');
        }

        $session = DB::transaction(fn () => DispatchSession::create([
            'company_id' => $board->company_id,
            'dispatch_board_id' => $board->id,
            'status' => DispatchSessionStatus::Open->value,
            'mode' => $mode,
            'started_at' => Carbon::now(),
            'operator_id' => $operatorId,
            'operator_name' => $operatorName,
        ]));

        $this->timeline->record(
            eventType: DispatchTimelineEvent::TYPE_SESSION_OPENED,
            title: 'Dispatch session opened',
            description: sprintf('%s opened a %s session.', $operatorName ?? 'An operator', $mode),
            companyId: $board->company_id,
            boardId: $board->id,
            sessionId: $session->id,
            actorId: $operatorId,
            actorName: $operatorName,
        );

        $this->audit->record(
            action: DispatchAuditEntry::ACTION_SESSION_OPENED,
            companyId: $board->company_id,
            sessionId: $session->id,
            entityType: 'dispatch_session',
            entityId: $session->uuid,
            actorId: $operatorId,
            actorName: $operatorName,
        );

        return $session;
    }

    public function changeStatus(
        DispatchSession $session,
        DispatchSessionStatus $target,
        ?string $reason = null,
    ): DispatchSession {
        $current = $session->status;

        if ($current === $target) {
            return $session;
        }

        if (! $current->canTransitionTo($target)) {
            throw DispatchOperationsException::invalidSessionTransition($current, $target);
        }

        return DB::transaction(function () use ($session, $target, $reason) {
            $stamp = $target->isTerminal() ? ['ended_at' => Carbon::now()] : [];

            $session->update($stamp + [
                'status' => $target->value,
                'close_reason' => $reason,
            ]);

            // A finished session must not keep holding resources.
            if ($target->releasesLocks()) {
                $this->locks->releaseAllFor(
                    $session,
                    $target === DispatchSessionStatus::Abandoned
                        ? 'Session abandoned.'
                        : 'Session closed.',
                );
            }

            return $session->refresh();
        });
    }

    public function close(
        DispatchSession $session,
        ?string $reason = null,
        ?int $actorId = null,
        ?string $actorName = null,
    ): DispatchSession {
        if ($session->status === DispatchSessionStatus::Open
            || $session->status === DispatchSessionStatus::Paused) {
            $this->changeStatus($session, DispatchSessionStatus::Closing);
            $session->refresh();
        }

        $closed = $this->changeStatus($session, DispatchSessionStatus::Closed, $reason);

        $this->timeline->record(
            eventType: DispatchTimelineEvent::TYPE_SESSION_CLOSED,
            title: 'Dispatch session closed',
            description: sprintf(
                '%d assigned, %d released, %d conflict(s) over %s minutes.',
                $closed->assigned_count,
                $closed->released_count,
                $closed->conflict_count,
                $closed->durationMinutes() ?? 0,
            ),
            companyId: $closed->company_id,
            boardId: $closed->dispatch_board_id,
            sessionId: $closed->id,
            actorId: $actorId,
            actorName: $actorName,
        );

        $this->audit->record(
            action: DispatchAuditEntry::ACTION_SESSION_CLOSED,
            reason: $reason,
            companyId: $closed->company_id,
            sessionId: $closed->id,
            entityType: 'dispatch_session',
            entityId: $closed->uuid,
            changes: [
                'assigned' => $closed->assigned_count,
                'released' => $closed->released_count,
                'duration_minutes' => $closed->durationMinutes(),
            ],
            actorId: $actorId,
            actorName: $actorName,
        );

        return $closed;
    }

    /** Bump a running tally. Cheaper than aggregating on every board render. */
    public function increment(DispatchSession $session, string $counter, int $by = 1): void
    {
        if (! in_array($counter, ['assigned_count', 'released_count', 'conflict_count'], true)) {
            return;
        }

        $session->increment($counter, $by);
    }

    /**
     * Abandon sessions that have gone quiet, releasing their locks.
     *
     * Returns how many were abandoned. Without this, a dispatcher who walked
     * away holds vehicles until someone notices — and nobody notices until the
     * pool looks mysteriously empty.
     */
    public function sweepIdle(?Carbon $at = null): int
    {
        $at ??= Carbon::now();
        $count = 0;

        $candidates = DispatchSession::query()
            ->where('status', DispatchSessionStatus::Open->value)
            ->where('updated_at', '<', $at->copy()->subMinutes(DispatchSession::IDLE_TIMEOUT_MINUTES))
            ->get();

        foreach ($candidates as $session) {
            $this->changeStatus(
                $session,
                DispatchSessionStatus::Abandoned,
                'No activity for '.DispatchSession::IDLE_TIMEOUT_MINUTES.' minutes.',
            );
            $count++;
        }

        return $count;
    }
}
