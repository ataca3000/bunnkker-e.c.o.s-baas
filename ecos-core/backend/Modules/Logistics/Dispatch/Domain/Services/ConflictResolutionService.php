<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Logistics\Dispatch\Domain\Enums\ConflictStatus;
use Modules\Logistics\Dispatch\Domain\Events\DispatchConflictResolved;
use Modules\Logistics\Dispatch\Domain\Exceptions\DispatchOperationsException;
use Modules\Logistics\Dispatch\Domain\Models\DispatchAuditEntry;
use Modules\Logistics\Dispatch\Domain\Models\DispatchConflict;
use Modules\Logistics\Dispatch\Domain\Models\DispatchTimelineEvent;

/**
 * Closing conflicts.
 *
 * Two ways out, and the difference matters:
 *
 *   • RESOLVE — the underlying condition changed. The clash is genuinely gone.
 *   • OVERRIDE — the clash stands, and a human is proceeding anyway. Always
 *     requires a reason, always audited, and only for conflicts a human is
 *     entitled to overrule.
 *
 * A safety conflict owned by Fleet is not Dispatch's to wave through — the
 * override path refuses it and points at the module that must fix it.
 */
class ConflictResolutionService
{
    public function __construct(
        private readonly ConflictDetectionService $detection,
        private readonly DispatchAuditService $audit,
        private readonly DispatchTimelineService $timeline,
    ) {}

    public function acknowledge(DispatchConflict $conflict): DispatchConflict
    {
        $this->assertTransition($conflict, ConflictStatus::Acknowledged);

        $conflict->update(['status' => ConflictStatus::Acknowledged->value]);

        return $conflict->refresh();
    }

    /** The condition genuinely changed. */
    public function resolve(
        DispatchConflict $conflict,
        string $resolution,
        ?string $reason = null,
        ?int $actorId = null,
        ?string $actorName = null,
    ): DispatchConflict {
        $this->assertTransition($conflict, ConflictStatus::Resolved);

        $resolved = DB::transaction(function () use ($conflict, $resolution, $reason, $actorId) {
            $conflict->update([
                'status' => ConflictStatus::Resolved->value,
                'resolution' => $resolution,
                'resolution_reason' => $reason,
                'resolved_at' => Carbon::now(),
                'resolved_by' => $actorId,
            ]);

            return $conflict->refresh();
        });

        $this->audit->record(
            action: DispatchAuditEntry::ACTION_CONFLICT_RESOLVED,
            reason: $reason,
            companyId: $resolved->company_id,
            sessionId: $resolved->dispatch_session_id,
            assignmentId: $resolved->assignment_id,
            entityType: 'dispatch_conflict',
            entityId: $resolved->uuid,
            changes: ['resolution' => $resolution],
            actorId: $actorId,
            actorName: $actorName,
        );

        $this->timeline->record(
            eventType: DispatchTimelineEvent::TYPE_CONFLICT_RESOLVED,
            title: 'Conflict resolved',
            description: $resolved->conflict_type->label().' — '.$resolution,
            companyId: $resolved->company_id,
            sessionId: $resolved->dispatch_session_id,
            assignmentId: $resolved->assignment_id,
            actorId: $actorId,
            actorName: $actorName,
        );

        // Notification only — fired after the state change is committed and
        // recorded, so no listener can affect the outcome (ADR-011).
        DispatchConflictResolved::dispatch(
            $resolved->uuid,
            $resolved->conflict_type->value,
            $resolved->authority(),
            $resolution,
            $resolved->company_id,
            ($resolved->resolved_at ?? Carbon::now())->toIso8601String(),
        );

        return $resolved;
    }

    /**
     * Proceed despite the clash.
     *
     * Refuses for conflicts whose authority is another module: a vehicle Fleet
     * calls unfit is a safety matter, and clearing it from Dispatch would
     * silently route around the readiness authority. Those must be fixed where
     * they live, or overridden there with that module's own override
     * permission.
     */
    public function override(
        DispatchConflict $conflict,
        string $reason,
        ?int $actorId = null,
        ?string $actorName = null,
    ): DispatchConflict {
        $this->assertTransition($conflict, ConflictStatus::Overridden);

        if (trim($reason) === '') {
            throw DispatchOperationsException::conflictOverrideReasonRequired();
        }

        // Directive 5/7/8: Dispatch may not overrule another authority's fact.
        if ($conflict->authority() !== 'dispatch') {
            throw DispatchOperationsException::allocationBlocked([
                sprintf(
                    'This conflict is owned by %s and must be cleared there — %s',
                    $conflict->authority(),
                    $conflict->description,
                ),
            ]);
        }

        $overridden = DB::transaction(function () use ($conflict, $reason, $actorId) {
            $conflict->update([
                'status' => ConflictStatus::Overridden->value,
                'resolution' => DispatchConflict::RESOLUTION_OVERRIDDEN,
                'resolution_reason' => $reason,
                'resolved_at' => Carbon::now(),
                'resolved_by' => $actorId,
            ]);

            return $conflict->refresh();
        });

        $this->audit->record(
            action: DispatchAuditEntry::ACTION_CONFLICT_OVERRIDDEN,
            reason: $reason,
            companyId: $overridden->company_id,
            sessionId: $overridden->dispatch_session_id,
            assignmentId: $overridden->assignment_id,
            entityType: 'dispatch_conflict',
            entityId: $overridden->uuid,
            changes: ['conflict_type' => $overridden->conflict_type->value],
            actorId: $actorId,
            actorName: $actorName,
        );

        $this->timeline->record(
            eventType: DispatchTimelineEvent::TYPE_CONFLICT_RESOLVED,
            title: 'Conflict overridden',
            description: $overridden->conflict_type->label().' — '.$reason,
            severity: 'warning',
            companyId: $overridden->company_id,
            sessionId: $overridden->dispatch_session_id,
            assignmentId: $overridden->assignment_id,
            actorId: $actorId,
            actorName: $actorName,
        );

        DispatchConflictResolved::dispatch(
            $overridden->uuid,
            $overridden->conflict_type->value,
            $overridden->authority(),
            DispatchConflict::RESOLUTION_OVERRIDDEN,
            $overridden->company_id,
            ($overridden->resolved_at ?? Carbon::now())->toIso8601String(),
        );

        return $overridden;
    }

    /**
     * Re-check open conflicts and close the ones that no longer apply.
     *
     * A conflict list that only grows is one operators learn to ignore, so a
     * clash whose cause disappeared must close itself.
     */
    public function expireStale(
        \Modules\Logistics\Dispatch\Domain\Models\ResourceAllocation $allocation,
    ): int {
        $open = DispatchConflict::query()
            ->where('allocation_id', $allocation->id)
            ->whereIn('status', [ConflictStatus::Open->value, ConflictStatus::Acknowledged->value])
            ->get();

        if ($open->isEmpty()) {
            return 0;
        }

        // Ask the authorities again.
        $stillPresent = collect($this->detection->detectFor($allocation))
            ->pluck('conflict_type')
            ->map(static fn ($type) => $type->value)
            ->all();

        $expired = 0;

        foreach ($open as $conflict) {
            if (in_array($conflict->conflict_type->value, $stillPresent, true)) {
                continue;
            }

            $conflict->update([
                'status' => ConflictStatus::Expired->value,
                'resolution' => DispatchConflict::RESOLUTION_CONDITION_CLEARED,
                'resolved_at' => Carbon::now(),
            ]);
            $expired++;
        }

        return $expired;
    }

    private function assertTransition(DispatchConflict $conflict, ConflictStatus $target): void
    {
        if (! $conflict->status->canTransitionTo($target)) {
            throw DispatchOperationsException::invalidConflictTransition($conflict->status, $target);
        }
    }
}
