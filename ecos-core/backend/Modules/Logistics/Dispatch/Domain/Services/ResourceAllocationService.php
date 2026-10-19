<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Logistics\Dispatch\Domain\Enums\AllocationStatus;
use Modules\Logistics\Dispatch\Domain\Exceptions\DispatchOperationsException;
use Modules\Logistics\Dispatch\Domain\Models\AssignmentLock;
use Modules\Logistics\Dispatch\Domain\Models\DispatchAuditEntry;
use Modules\Logistics\Dispatch\Domain\Models\DispatchProposedAssignment;
use Modules\Logistics\Dispatch\Domain\Models\DispatchSession;
use Modules\Logistics\Dispatch\Domain\Models\DispatchTimelineEvent;
use Modules\Logistics\Dispatch\Domain\Models\ResourceAllocation;
use Modules\Logistics\Distribution\Domain\Models\Trip;
use Modules\Logistics\Fleet\Domain\Contracts\FleetReadinessQueryInterface;
use Modules\Logistics\Network\Domain\Models\CapacitySlot;
use Modules\Logistics\Network\Domain\Services\CapacityLedgerService;

/**
 * Vehicle and driver allocation, with capacity reservation.
 *
 * ┌─ DIRECTIVES 4, 5, 11, 12 — REUSE, NEVER DUPLICATE ──────────────────────┐
 * │ This service ORCHESTRATES existing authorities; it re-implements none:   │
 * │                                                                          │
 * │   Fleet     → FleetReadinessQueryInterface  (vehicle fitness)            │
 * │   Drivers   → Driver::canStartDeliveries()  (via ConflictDetection)      │
 * │   Network   → CapacityLedgerService         (capacity arithmetic)        │
 * │   Dispatch  → AssignmentLockService         (mutual exclusion)           │
 * │                                                                          │
 * │ It computes no fitness, no capacity and no licence rule of its own. The  │
 * │ verdicts it stores are SNAPSHOTS for the audit trail.                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class ResourceAllocationService
{
    public function __construct(
        private readonly FleetReadinessQueryInterface $fleetReadiness,
        private readonly CapacityLedgerService $capacity,
        private readonly AssignmentLockService $locks,
        private readonly ConflictDetectionService $conflicts,
        private readonly DispatchAuditService $audit,
        private readonly DispatchTimelineService $timeline,
        private readonly DispatchSessionService $sessions,
    ) {}

    /**
     * Allocate a vehicle and driver to a trip.
     *
     * Locks first, then records, then detects. Locking before recording is
     * what stops two dispatchers racing to the same van; detecting after
     * recording is what lets the conflict reference the allocation it blocks.
     */
    public function allocate(
        DispatchSession $session,
        Trip $trip,
        int $vehicleId,
        int $driverId,
        ?DispatchProposedAssignment $assignment = null,
        string $mode = ResourceAllocation::MODE_MANUAL,
        ?int $actorId = null,
        ?string $actorName = null,
    ): ResourceAllocation {
        if (! $session->isActive()) {
            throw DispatchOperationsException::sessionNotActive($session->status->label());
        }

        // Mutual exclusion first — all or nothing, so a half-taken pair never
        // strands a resource nobody can use.
        $this->locks->acquireMany($session, [
            [AssignmentLock::RESOURCE_VEHICLE, $vehicleId],
            [AssignmentLock::RESOURCE_DRIVER, $driverId],
            [AssignmentLock::RESOURCE_TRIP, $trip->id],
        ]);

        // Fleet's verdict, snapshotted for the audit trail. Not recomputed.
        $verdict = $this->fleetReadiness->verdictFor($vehicleId);

        $allocation = DB::transaction(fn () => ResourceAllocation::create([
            'company_id' => $session->company_id,
            'dispatch_session_id' => $session->id,
            'assignment_id' => $assignment?->id,
            'trip_id' => $trip->id,
            'vehicle_id' => $vehicleId,
            'driver_id' => $driverId,
            'status' => AllocationStatus::Proposed->value,
            'allocation_mode' => $mode,
            'fleet_verdict' => $verdict->level->value,
            'allocated_at' => Carbon::now(),
            'allocated_by' => $actorId,
        ]));

        $detected = $this->conflicts->detectFor($allocation, $session);

        if ($detected !== []) {
            $this->sessions->increment($session, 'conflict_count', count($detected));

            foreach ($detected as $conflict) {
                $this->timeline->record(
                    eventType: DispatchTimelineEvent::TYPE_CONFLICT_DETECTED,
                    title: $conflict->conflict_type->label(),
                    description: $conflict->description,
                    severity: $conflict->conflict_type->isBlocking() ? 'critical' : 'warning',
                    companyId: $session->company_id,
                    boardId: $session->dispatch_board_id,
                    sessionId: $session->id,
                    assignmentId: $assignment?->id,
                    actorId: $actorId,
                    actorName: $actorName,
                );
            }
        }

        $this->audit->record(
            action: $mode === ResourceAllocation::MODE_AUTOMATIC
                ? DispatchAuditEntry::ACTION_ASSIGNED_AUTOMATIC
                : DispatchAuditEntry::ACTION_ASSIGNED_MANUAL,
            companyId: $session->company_id,
            sessionId: $session->id,
            assignmentId: $assignment?->id,
            entityType: 'resource_allocation',
            entityId: $allocation->uuid,
            changes: [
                'trip_id' => $trip->id,
                'vehicle_id' => $vehicleId,
                'driver_id' => $driverId,
                'fleet_verdict' => $verdict->level->value,
                'conflicts' => count($detected),
            ],
            actorId: $actorId,
            actorName: $actorName,
        );

        return $allocation->refresh();
    }

    /**
     * Hold capacity for an allocation.
     *
     * Delegates the arithmetic entirely to Network's ledger and stores only the
     * commitment UUID it returns. Dispatch performs no capacity maths.
     */
    public function reserveCapacity(
        ResourceAllocation $allocation,
        CapacitySlot $slot,
        array $quantities,
        ?int $actorId = null,
    ): ResourceAllocation {
        $this->assertTransition($allocation, AllocationStatus::Reserved);

        $commitment = $this->capacity->reserve(
            $slot,
            $quantities,
            'dispatch_allocation',
            $allocation->uuid,
            null,
            $actorId,
        );

        $allocation->update([
            'status' => AllocationStatus::Reserved->value,
            // The receipt. Network owns the numbers.
            'capacity_commitment_uuid' => $commitment->uuid,
        ]);

        return $allocation->refresh();
    }

    /**
     * Mark the allocation confirmed once V1 has committed it.
     *
     * Refuses while a blocking conflict stands — Distribution is the execution
     * authority, and handing it a known-broken assignment is how a bad morning
     * starts.
     */
    public function confirm(
        ResourceAllocation $allocation,
        ?int $actorId = null,
        ?string $actorName = null,
    ): ResourceAllocation {
        // Reserved is the normal path; a Proposed allocation with no capacity
        // to hold may confirm directly.
        if ($allocation->status === AllocationStatus::Proposed) {
            $allocation->update(['status' => AllocationStatus::Reserved->value]);
            $allocation->refresh();
        }

        $this->assertTransition($allocation, AllocationStatus::Confirmed);

        $blockers = $this->conflicts->outstandingBlockers($allocation);

        if ($blockers !== []) {
            throw DispatchOperationsException::blockingConflictsOutstanding(
                array_map(static fn ($c) => $c->description, $blockers)
            );
        }

        $confirmed = DB::transaction(function () use ($allocation, $actorId) {
            $allocation->update([
                'status' => AllocationStatus::Confirmed->value,
                'confirmed_at' => Carbon::now(),
            ]);

            // The capacity hold becomes a firm commitment.
            if ($allocation->capacity_commitment_uuid !== null) {
                $commitment = \Modules\Logistics\Network\Domain\Models\CapacityCommitment::query()
                    ->where('uuid', $allocation->capacity_commitment_uuid)
                    ->first();

                if ($commitment !== null && $commitment->status->canTransitionTo(
                    \Modules\Logistics\Network\Domain\Enums\CapacityCommitmentStatus::Committed
                )) {
                    $this->capacity->commit($commitment);
                }
            }

            return $allocation->refresh();
        });

        return $confirmed;
    }

    /**
     * Give everything back: locks, capacity, and the allocation itself.
     *
     * Releasing capacity through Network's ledger rather than adjusting a
     * number here is what keeps the single-writer rule intact.
     */
    public function release(
        ResourceAllocation $allocation,
        ?string $reason = null,
        ?int $actorId = null,
    ): ResourceAllocation {
        if ($allocation->status->isTerminal()) {
            return $allocation;
        }

        return DB::transaction(function () use ($allocation, $reason, $actorId) {
            if ($allocation->capacity_commitment_uuid !== null) {
                $commitment = \Modules\Logistics\Network\Domain\Models\CapacityCommitment::query()
                    ->where('uuid', $allocation->capacity_commitment_uuid)
                    ->first();

                if ($commitment !== null && ! $commitment->status->isTerminal()) {
                    $this->capacity->release($commitment, $reason ?? 'Allocation released.');
                }
            }

            foreach ([
                [AssignmentLock::RESOURCE_VEHICLE, $allocation->vehicle_id],
                [AssignmentLock::RESOURCE_DRIVER, $allocation->driver_id],
                [AssignmentLock::RESOURCE_TRIP, $allocation->trip_id],
            ] as [$type, $id]) {
                if ($id === null) {
                    continue;
                }

                $lock = $this->locks->currentHolder($type, (int) $id);

                if ($lock !== null && $lock->dispatch_session_id === $allocation->dispatch_session_id) {
                    $this->locks->release($lock, $reason ?? 'Allocation released.');
                }
            }

            $allocation->update([
                'status' => AllocationStatus::Released->value,
                'released_at' => Carbon::now(),
                'release_reason' => $reason,
            ]);

            return $allocation->refresh();
        });
    }

    public function fail(ResourceAllocation $allocation, string $reason): ResourceAllocation
    {
        $this->assertTransition($allocation, AllocationStatus::Failed);

        $allocation->update([
            'status' => AllocationStatus::Failed->value,
            'release_reason' => $reason,
        ]);

        return $allocation->refresh();
    }

    private function assertTransition(ResourceAllocation $allocation, AllocationStatus $target): void
    {
        if (! $allocation->status->canTransitionTo($target)) {
            throw DispatchOperationsException::invalidAllocationTransition(
                $allocation->status,
                $target,
            );
        }
    }
}
