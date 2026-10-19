<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Services;

use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Logistics\Dispatch\Domain\Enums\LockStatus;
// Both are imported deliberately: throws are Phase 3 specific, but the
// rollback catch takes the PARENT so it also covers Phase 2 failures.
use Modules\Logistics\Dispatch\Domain\Exceptions\DispatchException;
use Modules\Logistics\Dispatch\Domain\Exceptions\DispatchOperationsException;
use Modules\Logistics\Dispatch\Domain\Models\AssignmentLock;
use Modules\Logistics\Dispatch\Domain\Models\DispatchSession;

/**
 * Short-lived holds on vehicles, drivers and trips.
 *
 * ┌─ THE MUTUAL-EXCLUSION INVARIANT ────────────────────────────────────────┐
 * │ Contention is decided by a UNIQUE INDEX, not by a read-then-write check. │
 * │ acquire() attempts the insert and treats the constraint violation as     │
 * │ "someone else got there first" — under real concurrency a check-then-act │
 * │ loses that race, and two dispatchers end up believing they hold the same │
 * │ van.                                                                     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Every lock expires. A dispatcher who closes their laptop must not hold a
 * vehicle hostage, so the TTL is the safety net and the sweep is the janitor.
 */
class AssignmentLockService
{
    public function __construct(
        private readonly DispatchAuditService $audit,
    ) {}

    /**
     * Take a lock, or fail because someone else holds it.
     *
     * Expired locks are reclaimed first so a stale hold never blocks a live
     * dispatcher.
     */
    public function acquire(
        DispatchSession $session,
        string $resourceType,
        int $resourceId,
        ?int $ttlMinutes = null,
    ): AssignmentLock {
        if (! $session->isActive()) {
            throw DispatchOperationsException::sessionNotActive($session->status->label());
        }

        // Reclaim anything that timed out before contending for it.
        $this->expireStale($resourceType, $resourceId);

        // A session re-acquiring its OWN lock extends it rather than failing.
        // Locks exist for cross-session exclusion, not to stop one dispatcher
        // touching a resource twice — a genuine double-booking within a session
        // is caught by ConflictDetectionService, where it can be explained.
        $mine = $this->currentHolder($resourceType, $resourceId);

        if ($mine !== null && $mine->dispatch_session_id === $session->id) {
            $mine->update([
                'expires_at' => Carbon::now()->addMinutes(
                    $ttlMinutes ?? AssignmentLock::DEFAULT_TTL_MINUTES
                ),
            ]);

            return $mine->refresh();
        }

        try {
            return DB::transaction(fn () => AssignmentLock::create([
                'company_id' => $session->company_id,
                'dispatch_session_id' => $session->id,
                'resource_type' => $resourceType,
                'resource_id' => $resourceId,
                'status' => LockStatus::Held->value,
                'acquired_at' => Carbon::now(),
                'expires_at' => Carbon::now()->addMinutes(
                    $ttlMinutes ?? AssignmentLock::DEFAULT_TTL_MINUTES
                ),
                'held_by' => $session->operator_id,
                'held_by_name' => $session->operator_name,
                'active_flag' => 1,
            ]));
        } catch (UniqueConstraintViolationException) {
            // The index did its job: someone else holds it.
            $holder = $this->currentHolder($resourceType, $resourceId);

            throw DispatchOperationsException::resourceLocked(
                $resourceType,
                $holder?->held_by_name ?? 'another session',
                $holder?->remainingSeconds() ?? 0,
            );
        }
    }

    /** Acquire several locks atomically — all or nothing. */
    public function acquireMany(
        DispatchSession $session,
        array $resources,
        ?int $ttlMinutes = null,
    ): array {
        $acquired = [];

        try {
            foreach ($resources as [$type, $id]) {
                $acquired[] = $this->acquire($session, $type, (int) $id, $ttlMinutes);
            }
        } catch (DispatchException $e) {
            // Partial acquisition is worse than none — it strands resources
            // nobody can use until the TTL expires.
            foreach ($acquired as $lock) {
                $this->release($lock, 'Rolled back: could not acquire the full set.');
            }

            throw $e;
        }

        return $acquired;
    }

    public function release(AssignmentLock $lock, ?string $reason = null): AssignmentLock
    {
        if (! $lock->isHeld()) {
            return $lock;
        }

        $lock->update([
            'status' => LockStatus::Released->value,
            'released_at' => Carbon::now(),
            'release_reason' => $reason,
            // Freeing the unique slot is what lets the next dispatcher in.
            'active_flag' => null,
        ]);

        return $lock->refresh();
    }

    /** Release every lock a session still holds. Called when a session ends. */
    public function releaseAllFor(DispatchSession $session, ?string $reason = null): int
    {
        $locks = $session->heldLocks()->get();

        foreach ($locks as $lock) {
            $this->release($lock, $reason ?? 'Session ended.');
        }

        return $locks->count();
    }

    /**
     * Force-release another dispatcher's lock.
     *
     * Always requires a reason and is always audited — taking a resource from
     * a colleague mid-decision is exactly the action a supervisor later needs
     * to reconstruct.
     */
    public function breakLock(
        AssignmentLock $lock,
        string $reason,
        ?int $actorId = null,
        ?string $actorName = null,
    ): AssignmentLock {
        if (trim($reason) === '') {
            throw DispatchOperationsException::lockBreakReasonRequired();
        }

        $lock->update([
            'status' => LockStatus::Broken->value,
            'released_at' => Carbon::now(),
            'release_reason' => $reason,
            'active_flag' => null,
        ]);

        $this->audit->record(
            action: \Modules\Logistics\Dispatch\Domain\Models\DispatchAuditEntry::ACTION_LOCK_BROKEN,
            reason: $reason,
            companyId: $lock->company_id,
            sessionId: $lock->dispatch_session_id,
            entityType: 'assignment_lock',
            entityId: $lock->uuid,
            changes: [
                'resource' => $lock->describeResource(),
                'taken_from' => $lock->held_by_name,
            ],
            actorId: $actorId,
            actorName: $actorName,
        );

        return $lock->refresh();
    }

    /** Is this resource effectively locked right now? */
    public function isLocked(string $resourceType, int $resourceId): bool
    {
        return $this->currentHolder($resourceType, $resourceId) !== null;
    }

    public function currentHolder(string $resourceType, int $resourceId): ?AssignmentLock
    {
        $lock = AssignmentLock::query()
            ->where('resource_type', $resourceType)
            ->where('resource_id', $resourceId)
            ->whereNotNull('active_flag')
            ->first();

        if ($lock === null) {
            return null;
        }

        // An expired hold is not a holder.
        return $lock->isEffective() ? $lock : null;
    }

    /**
     * Reclaim every timed-out lock. Returns how many were reclaimed.
     *
     * Without this, a crashed browser tab quietly removes a vehicle from the
     * pool for the rest of the day.
     */
    public function sweepExpired(?Carbon $at = null): int
    {
        $at ??= Carbon::now();

        $expired = AssignmentLock::query()
            ->where('status', LockStatus::Held->value)
            ->where('expires_at', '<', $at)
            ->get();

        foreach ($expired as $lock) {
            $lock->update([
                'status' => LockStatus::Expired->value,
                'released_at' => $at,
                'release_reason' => 'Lock expired without being released.',
                'active_flag' => null,
            ]);
        }

        return $expired->count();
    }

    private function expireStale(string $resourceType, int $resourceId): void
    {
        AssignmentLock::query()
            ->where('resource_type', $resourceType)
            ->where('resource_id', $resourceId)
            ->where('status', LockStatus::Held->value)
            ->where('expires_at', '<', Carbon::now())
            ->update([
                'status' => LockStatus::Expired->value,
                'released_at' => Carbon::now(),
                'release_reason' => 'Lock expired without being released.',
                'active_flag' => null,
            ]);
    }
}
