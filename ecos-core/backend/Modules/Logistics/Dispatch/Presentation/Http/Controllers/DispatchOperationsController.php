<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Modules\Logistics\Dispatch\Domain\Enums\AllocationStatus;
use Modules\Logistics\Dispatch\Domain\Enums\ConflictStatus;
use Modules\Logistics\Dispatch\Domain\Enums\ConflictType;
use Modules\Logistics\Dispatch\Domain\Enums\DispatchSessionStatus;
use Modules\Logistics\Dispatch\Domain\Enums\LockStatus;
use Modules\Logistics\Dispatch\Domain\Enums\QueueItemStatus;
use Modules\Logistics\Dispatch\Domain\Enums\QueuePriority;
use Modules\Logistics\Dispatch\Domain\Enums\ReviewStatus;
use Modules\Logistics\Dispatch\Domain\Exceptions\DispatchException;
use Modules\Logistics\Dispatch\Domain\Models\AssignmentLock;
use Modules\Logistics\Dispatch\Domain\Models\AssignmentReview;
use Modules\Logistics\Dispatch\Domain\Models\DispatchBoard;
use Modules\Logistics\Dispatch\Domain\Models\DispatchConflict;
use Modules\Logistics\Dispatch\Domain\Models\DispatchProposedAssignment;
use Modules\Logistics\Dispatch\Domain\Models\DispatchQueueItem;
use Modules\Logistics\Dispatch\Domain\Models\DispatchSession;
use Modules\Logistics\Dispatch\Domain\Models\ResourceAllocation;
use Modules\Logistics\Dispatch\Domain\Services\AssignmentLockService;
use Modules\Logistics\Dispatch\Domain\Services\AssignmentReviewService;
use Modules\Logistics\Dispatch\Domain\Services\ConflictResolutionService;
use Modules\Logistics\Dispatch\Domain\Services\DispatchAuditService;
use Modules\Logistics\Dispatch\Domain\Services\DispatchMonitoringService;
use Modules\Logistics\Dispatch\Domain\Services\DispatchQueueService;
use Modules\Logistics\Dispatch\Domain\Services\DispatchSessionService;
use Modules\Logistics\Dispatch\Domain\Services\DispatchTimelineService;
use Modules\Logistics\Dispatch\Domain\Services\ResourceAllocationService;
use Modules\Logistics\Dispatch\Presentation\Http\Resources\DispatchSessionResource;
use Modules\Logistics\Dispatch\Presentation\Http\Resources\QueueItemResource;
use Modules\Logistics\Distribution\Domain\Models\Trip;

/**
 * Phase 3 — dispatch operations, execution, allocation and monitoring.
 *
 * ADDITIVE: the Phase 2 DispatchController is untouched. This controller adds
 * the operational surface on top of it.
 */
class DispatchOperationsController extends Controller
{
    public function __construct(
        private readonly DispatchSessionService $sessions,
        private readonly DispatchQueueService $queue,
        private readonly AssignmentLockService $locks,
        private readonly ResourceAllocationService $allocations,
        private readonly ConflictResolutionService $conflicts,
        private readonly AssignmentReviewService $reviews,
        private readonly DispatchMonitoringService $monitoring,
        private readonly DispatchTimelineService $timeline,
        private readonly DispatchAuditService $audit,
    ) {}

    public function options(): JsonResponse
    {
        return response()->json([
            'session_statuses' => DispatchSessionStatus::options(),
            'session_modes' => [
                ['value' => DispatchSession::MODE_MANUAL, 'label' => 'Manual'],
                ['value' => DispatchSession::MODE_AUTOMATIC, 'label' => 'Automatic'],
                ['value' => DispatchSession::MODE_HYBRID, 'label' => 'Hybrid'],
            ],
            'queue_statuses' => QueueItemStatus::options(),
            'queue_priorities' => QueuePriority::options(),
            'allocation_statuses' => AllocationStatus::options(),
            'conflict_types' => ConflictType::options(),
            'conflict_statuses' => ConflictStatus::options(),
            'review_statuses' => ReviewStatus::options(),
            'lock_statuses' => LockStatus::options(),
        ]);
    }

    // ── Sessions ─────────────────────────────────────────────────────────────

    public function sessions(Request $request): JsonResponse
    {
        $query = DispatchSession::query()
            ->when($this->companyId($request), fn ($q, $id) => $q->where('company_id', $id))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->with('board')
            ->latest('started_at');

        return DispatchSessionResource::collection(
            $query->paginate(max(1, min((int) $request->integer('per_page', 20), 100)))
        )->response();
    }

    public function openSession(Request $request, string $boardId): JsonResponse
    {
        $validated = $request->validate([
            'mode' => ['nullable', Rule::in([
                DispatchSession::MODE_MANUAL,
                DispatchSession::MODE_AUTOMATIC,
                DispatchSession::MODE_HYBRID,
            ])],
        ]);

        try {
            $session = $this->sessions->open(
                $this->board($boardId),
                $validated['mode'] ?? DispatchSession::MODE_MANUAL,
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (DispatchException $e) {
            return $this->unprocessable($e);
        }

        return (new DispatchSessionResource($session))->response()->setStatusCode(201);
    }

    public function setSessionStatus(Request $request, string $id): JsonResponse|DispatchSessionResource
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(DispatchSessionStatus::values())],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            $session = $this->sessions->changeStatus(
                $this->session($id),
                DispatchSessionStatus::from($validated['status']),
                $validated['reason'] ?? null,
            );
        } catch (DispatchException $e) {
            return $this->unprocessable($e);
        }

        return new DispatchSessionResource($session);
    }

    public function closeSession(Request $request, string $id): JsonResponse|DispatchSessionResource
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            $session = $this->sessions->close(
                $this->session($id),
                $validated['reason'] ?? null,
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (DispatchException $e) {
            return $this->unprocessable($e);
        }

        return new DispatchSessionResource($session);
    }

    // ── Queue ────────────────────────────────────────────────────────────────

    public function queue(string $boardId): JsonResponse
    {
        return QueueItemResource::collection(
            $this->queue->forBoard($this->board($boardId))
        )->response();
    }

    public function buildQueue(Request $request, string $boardId): JsonResponse
    {
        $added = $this->queue->build(
            $this->board($boardId),
            $request->user()?->id,
            $request->user()?->name,
        );

        return response()->json(['added' => $added, 'message' => "{$added} trip(s) queued."]);
    }

    public function claimNext(string $sessionId): JsonResponse|QueueItemResource
    {
        try {
            $item = $this->queue->claimNext($this->session($sessionId));
        } catch (DispatchException $e) {
            return $this->unprocessable($e);
        }

        if ($item === null) {
            return response()->json(['data' => null, 'message' => 'The queue is empty.']);
        }

        return new QueueItemResource($item->load('trip'));
    }

    public function claimItem(string $sessionId, string $itemId): JsonResponse|QueueItemResource
    {
        try {
            $item = $this->queue->claim($this->queueItem($itemId), $this->session($sessionId));
        } catch (DispatchException $e) {
            return $this->unprocessable($e);
        }

        return new QueueItemResource($item->load('trip'));
    }

    public function prioritiseItem(Request $request, string $itemId): JsonResponse|QueueItemResource
    {
        $validated = $request->validate([
            'priority' => ['required', Rule::in(QueuePriority::values())],
            'reason' => ['required', 'string', 'max:200'],
        ]);

        $item = $this->queue->prioritise(
            $this->queueItem($itemId),
            QueuePriority::from($validated['priority']),
            $validated['reason'],
        );

        return new QueueItemResource($item);
    }

    public function deferItem(Request $request, string $itemId): JsonResponse|QueueItemResource
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            $item = $this->queue->defer($this->queueItem($itemId), $validated['reason'] ?? null);
        } catch (DispatchException $e) {
            return $this->unprocessable($e);
        }

        return new QueueItemResource($item);
    }

    // ── Allocation ───────────────────────────────────────────────────────────

    /**
     * Manual or automatic allocation.
     *
     * Locks the resources, records the decision, and surfaces every conflict
     * the authorities reported — with their own wording.
     */
    public function allocate(Request $request, string $sessionId): JsonResponse
    {
        $validated = $request->validate([
            'trip_id' => ['required', 'string', 'max:36'],
            'vehicle_id' => ['required', 'integer', 'exists:logistics_vehicles,id'],
            'driver_id' => ['required', 'integer', 'exists:logistics_drivers,id'],
            'assignment_id' => ['nullable', 'string', 'max:36'],
            'mode' => ['nullable', Rule::in([
                ResourceAllocation::MODE_MANUAL,
                ResourceAllocation::MODE_AUTOMATIC,
            ])],
        ]);

        $session = $this->session($sessionId);
        $trip = Trip::where('uuid', $validated['trip_id'])->firstOrFail();
        $assignment = isset($validated['assignment_id'])
            ? DispatchProposedAssignment::where('uuid', $validated['assignment_id'])->first()
            : null;

        try {
            $allocation = $this->allocations->allocate(
                $session,
                $trip,
                (int) $validated['vehicle_id'],
                (int) $validated['driver_id'],
                $assignment,
                $validated['mode'] ?? ResourceAllocation::MODE_MANUAL,
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (DispatchException $e) {
            return $this->unprocessable($e);
        }

        return response()->json(['data' => $this->allocationPayload($allocation)], 201);
    }

    public function confirmAllocation(Request $request, string $id): JsonResponse
    {
        try {
            $allocation = $this->allocations->confirm(
                $this->allocation($id),
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (DispatchException $e) {
            return $this->unprocessable($e);
        }

        return response()->json(['data' => $this->allocationPayload($allocation)]);
    }

    public function releaseAllocation(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $allocation = $this->allocations->release(
            $this->allocation($id),
            $validated['reason'] ?? null,
            $request->user()?->id,
        );

        return response()->json(['data' => $this->allocationPayload($allocation)]);
    }

    // ── Conflicts ────────────────────────────────────────────────────────────

    public function conflicts(Request $request): JsonResponse
    {
        $conflicts = DispatchConflict::query()
            ->when($this->companyId($request), fn ($q, $id) => $q->where('company_id', $id))
            ->when(
                $request->boolean('outstanding_only', true),
                fn ($q) => $q->whereIn('status', [
                    ConflictStatus::Open->value,
                    ConflictStatus::Acknowledged->value,
                ]),
            )
            ->latest('detected_at')
            ->limit((int) $request->integer('limit', 100))
            ->get()
            ->map(fn (DispatchConflict $c) => $this->conflictPayload($c));

        return response()->json(['data' => $conflicts]);
    }

    public function resolveConflict(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'resolution' => ['required', 'string', 'max:40'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            $conflict = $this->conflicts->resolve(
                $this->conflict($id),
                $validated['resolution'],
                $validated['reason'] ?? null,
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (DispatchException $e) {
            return $this->unprocessable($e);
        }

        return response()->json(['data' => $this->conflictPayload($conflict)]);
    }

    /** Refuses for conflicts owned by another module — see the service. */
    public function overrideConflict(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        try {
            $conflict = $this->conflicts->override(
                $this->conflict($id),
                $validated['reason'],
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (DispatchException $e) {
            return $this->unprocessable($e);
        }

        return response()->json(['data' => $this->conflictPayload($conflict)]);
    }

    // ── Reviews ──────────────────────────────────────────────────────────────

    public function pendingReviews(Request $request): JsonResponse
    {
        $reviews = $this->reviews->pending($this->companyId($request))
            ->map(fn (AssignmentReview $r) => $this->reviewPayload($r));

        return response()->json(['data' => $reviews]);
    }

    public function requestReview(Request $request, string $assignmentId): JsonResponse
    {
        $validated = $request->validate([
            'trigger' => ['required', Rule::in([
                AssignmentReview::TRIGGER_AUTOMATIC,
                AssignmentReview::TRIGGER_CONFLICT,
                AssignmentReview::TRIGGER_OVERRIDE,
                AssignmentReview::TRIGGER_POLICY,
                AssignmentReview::TRIGGER_MANUAL,
            ])],
            'trigger_reason' => ['nullable', 'string', 'max:1000'],
            'session_id' => ['nullable', 'string', 'max:36'],
        ]);

        $session = isset($validated['session_id'])
            ? DispatchSession::where('uuid', $validated['session_id'])->first()
            : null;

        try {
            $review = $this->reviews->request(
                $this->assignment($assignmentId),
                $validated['trigger'],
                $validated['trigger_reason'] ?? null,
                $session,
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (DispatchException $e) {
            return $this->unprocessable($e);
        }

        return response()->json(['data' => $this->reviewPayload($review)], 201);
    }

    public function approveReview(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            $review = $this->reviews->approve(
                $this->review($id),
                $validated['reason'] ?? null,
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (DispatchException $e) {
            return $this->unprocessable($e);
        }

        return response()->json(['data' => $this->reviewPayload($review)]);
    }

    public function rejectReview(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        try {
            $review = $this->reviews->reject(
                $this->review($id),
                $validated['reason'],
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (DispatchException $e) {
            return $this->unprocessable($e);
        }

        return response()->json(['data' => $this->reviewPayload($review)]);
    }

    // ── Locks ────────────────────────────────────────────────────────────────

    public function locks(Request $request): JsonResponse
    {
        $locks = AssignmentLock::query()
            ->when($this->companyId($request), fn ($q, $id) => $q->where('company_id', $id))
            ->where('status', LockStatus::Held->value)
            ->with('session')
            ->get()
            ->map(static fn (AssignmentLock $lock) => [
                'id' => $lock->uuid,
                'resource' => $lock->describeResource(),
                'resource_type' => $lock->resource_type,
                'resource_id' => $lock->resource_id,
                'held_by' => $lock->held_by_name,
                'session_id' => $lock->session?->uuid,
                'acquired_at' => $lock->acquired_at?->toIso8601String(),
                'expires_at' => $lock->expires_at?->toIso8601String(),
                'remaining_seconds' => $lock->remainingSeconds(),
                'is_effective' => $lock->isEffective(),
            ]);

        return response()->json(['data' => $locks]);
    }

    public function breakLock(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        $lock = AssignmentLock::where('uuid', $id)->firstOrFail();

        try {
            $broken = $this->locks->breakLock(
                $lock,
                $validated['reason'],
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (DispatchException $e) {
            return $this->unprocessable($e);
        }

        return response()->json([
            'data' => ['id' => $broken->uuid, 'status' => $broken->status->value],
        ]);
    }

    public function sweepLocks(): JsonResponse
    {
        return response()->json([
            'locks_reclaimed' => $this->locks->sweepExpired(),
            'sessions_abandoned' => $this->sessions->sweepIdle(),
        ]);
    }

    // ── Monitoring ───────────────────────────────────────────────────────────

    public function kpis(Request $request): JsonResponse
    {
        $from = $request->filled('from') ? Carbon::parse($request->string('from')) : null;
        $to = $request->filled('to') ? Carbon::parse($request->string('to')) : null;

        return response()->json([
            'data' => $this->monitoring->kpis($this->companyId($request), $from, $to),
        ]);
    }

    public function queueStatistics(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->monitoring->queueStatistics($this->companyId($request)),
        ]);
    }

    public function assignmentHealth(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->monitoring->assignmentHealth($this->companyId($request)),
        ]);
    }

    public function capacityUtilisation(Request $request): JsonResponse
    {
        $date = $request->filled('date') ? Carbon::parse($request->string('date')) : null;

        return response()->json([
            'data' => $this->monitoring->capacityUtilisation($this->companyId($request), $date),
        ]);
    }

    public function exceptions(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->monitoring->exceptions($this->companyId($request)),
        ]);
    }

    // ── Timeline and audit ───────────────────────────────────────────────────

    public function boardTimeline(string $boardId): JsonResponse
    {
        $events = $this->timeline->forBoard($this->board($boardId)->id)
            ->map(static fn ($event) => [
                'id' => $event->id,
                'event_type' => $event->event_type,
                'severity' => $event->severity,
                'title' => $event->title,
                'description' => $event->description,
                'is_problem' => $event->isProblem(),
                'occurred_at' => $event->occurred_at?->toIso8601String(),
                'actor_name' => $event->actor_name,
                'metadata' => $event->metadata ?? [],
            ]);

        return response()->json(['data' => $events]);
    }

    public function auditTrail(Request $request): JsonResponse
    {
        $entries = \Modules\Logistics\Dispatch\Domain\Models\DispatchAuditEntry::query()
            ->when($this->companyId($request), fn ($q, $id) => $q->where('company_id', $id))
            ->when($request->boolean('overrides_only'), fn ($q) => $q->whereIn('action', [
                \Modules\Logistics\Dispatch\Domain\Models\DispatchAuditEntry::ACTION_OVERRIDDEN,
                \Modules\Logistics\Dispatch\Domain\Models\DispatchAuditEntry::ACTION_CONFLICT_OVERRIDDEN,
                \Modules\Logistics\Dispatch\Domain\Models\DispatchAuditEntry::ACTION_LOCK_BROKEN,
            ]))
            ->latest('performed_at')
            ->limit((int) $request->integer('limit', 100))
            ->get()
            ->map(static fn ($entry) => [
                'id' => $entry->uuid,
                'action' => $entry->action,
                'is_override' => $entry->isOverride(),
                'entity_type' => $entry->entity_type,
                'entity_id' => $entry->entity_id,
                'changes' => $entry->changes ?? [],
                'reason' => $entry->reason,
                'performed_at' => $entry->performed_at?->toIso8601String(),
                'actor_name' => $entry->actor_name,
            ]);

        return response()->json(['data' => $entries]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function board(string $id): DispatchBoard
    {
        return DispatchBoard::where('uuid', $id)->firstOrFail();
    }

    private function session(string $id): DispatchSession
    {
        return DispatchSession::where('uuid', $id)->firstOrFail();
    }

    private function queueItem(string $id): DispatchQueueItem
    {
        return DispatchQueueItem::where('uuid', $id)->firstOrFail();
    }

    private function allocation(string $id): ResourceAllocation
    {
        return ResourceAllocation::where('uuid', $id)->firstOrFail();
    }

    private function conflict(string $id): DispatchConflict
    {
        return DispatchConflict::where('uuid', $id)->firstOrFail();
    }

    private function review(string $id): AssignmentReview
    {
        return AssignmentReview::where('uuid', $id)->firstOrFail();
    }

    private function assignment(string $id): DispatchProposedAssignment
    {
        return DispatchProposedAssignment::where('uuid', $id)->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function allocationPayload(ResourceAllocation $allocation): array
    {
        $allocation->loadMissing('trip');

        return [
            'id' => $allocation->uuid,
            'status' => $allocation->status->value,
            'status_label' => $allocation->status->label(),
            'status_tone' => $allocation->status->tone(),
            'holds_resource' => $allocation->holdsResource(),
            'allocation_mode' => $allocation->allocation_mode,
            'trip_id' => $allocation->trip?->uuid,
            'vehicle_id' => $allocation->vehicle_id,
            'driver_id' => $allocation->driver_id,
            // Snapshots of other modules' verdicts, not recomputed here.
            'fleet_verdict' => $allocation->fleet_verdict,
            'driver_ready' => $allocation->driver_ready,
            'has_capacity_hold' => $allocation->hasCapacityHold(),
            'allocated_at' => $allocation->allocated_at?->toIso8601String(),
            'confirmed_at' => $allocation->confirmed_at?->toIso8601String(),
            'released_at' => $allocation->released_at?->toIso8601String(),
            'conflicts' => DispatchConflict::query()
                ->where('allocation_id', $allocation->id)
                ->get()
                ->map(fn (DispatchConflict $c) => $this->conflictPayload($c))
                ->values(),
        ];
    }

    /** @return array<string, mixed> */
    private function conflictPayload(DispatchConflict $conflict): array
    {
        return [
            'id' => $conflict->uuid,
            'conflict_type' => $conflict->conflict_type->value,
            'conflict_label' => $conflict->conflict_type->label(),
            'severity' => $conflict->severity,
            'is_blocking' => $conflict->conflict_type->isBlocking(),
            'blocks_release' => $conflict->blocksRelease(),
            // Which module must fix it — Dispatch may not overrule another
            // authority's fact.
            'authority' => $conflict->authority(),
            'status' => $conflict->status->value,
            'status_label' => $conflict->status->label(),
            'description' => $conflict->description,
            'resource_type' => $conflict->resource_type,
            'resource_id' => $conflict->resource_id,
            'detected_at' => $conflict->detected_at?->toIso8601String(),
            'age_minutes' => $conflict->ageMinutes(),
            'resolution' => $conflict->resolution,
            'resolution_reason' => $conflict->resolution_reason,
        ];
    }

    /** @return array<string, mixed> */
    private function reviewPayload(AssignmentReview $review): array
    {
        return [
            'id' => $review->uuid,
            'assignment_id' => $review->assignment?->uuid,
            'status' => $review->status->value,
            'status_label' => $review->status->label(),
            'status_tone' => $review->status->tone(),
            'trigger' => $review->trigger,
            'trigger_reason' => $review->trigger_reason,
            'requested_at' => $review->requested_at?->toIso8601String(),
            'requested_by' => $review->requested_by,
            'decided_at' => $review->decided_at?->toIso8601String(),
            'decided_by_name' => $review->decided_by_name,
            'decision_reason' => $review->decision_reason,
            'waiting_minutes' => $review->waitingMinutes(),
        ];
    }

    private function unprocessable(DispatchException $e): JsonResponse
    {
        return response()->json(['message' => $e->getMessage()], 422);
    }

    private function companyId(Request $request): ?string
    {
        $companyId = $request->user()?->company_id;

        return $companyId === null ? null : (string) $companyId;
    }
}
