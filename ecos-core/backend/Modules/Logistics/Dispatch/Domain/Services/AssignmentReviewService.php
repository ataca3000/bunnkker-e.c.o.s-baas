<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Logistics\Dispatch\Domain\Enums\ReviewStatus;
use Modules\Logistics\Dispatch\Domain\Exceptions\DispatchOperationsException;
use Modules\Logistics\Dispatch\Domain\Models\AssignmentReview;
use Modules\Logistics\Dispatch\Domain\Models\DispatchAuditEntry;
use Modules\Logistics\Dispatch\Domain\Models\DispatchProposedAssignment;
use Modules\Logistics\Dispatch\Domain\Models\DispatchSession;
use Modules\Logistics\Dispatch\Domain\Models\DispatchTimelineEvent;

/**
 * Human sign-off on assignments that carry risk.
 *
 * Requesting and deciding are separate permissions, and for conflict or
 * override triggers the decider must differ from the requester — the same
 * separation-of-duties rule LOG-005 applied to POD capture vs. validation.
 *
 * Routine automatic-assignment reviews may be self-approved: insisting on a
 * second pair of eyes for every row would simply stall the morning, and a
 * control everyone routes around protects nothing.
 */
class AssignmentReviewService
{
    public function __construct(
        private readonly DispatchAuditService $audit,
        private readonly DispatchTimelineService $timeline,
    ) {}

    public function request(
        DispatchProposedAssignment $assignment,
        string $trigger,
        ?string $triggerReason = null,
        ?DispatchSession $session = null,
        ?int $actorId = null,
        ?string $actorName = null,
    ): AssignmentReview {
        $open = AssignmentReview::query()
            ->where('assignment_id', $assignment->id)
            ->whereNotNull('active_flag')
            ->exists();

        if ($open) {
            throw DispatchOperationsException::reviewAlreadyOpen();
        }

        $review = DB::transaction(fn () => AssignmentReview::create([
            'company_id' => $session?->company_id,
            'assignment_id' => $assignment->id,
            'dispatch_session_id' => $session?->id,
            'status' => ReviewStatus::Pending->value,
            'trigger' => $trigger,
            'trigger_reason' => $triggerReason,
            'requested_at' => Carbon::now(),
            'requested_by' => $actorId,
            'active_flag' => 1,
        ]));

        $this->timeline->record(
            eventType: DispatchTimelineEvent::TYPE_REVIEW_REQUESTED,
            title: 'Assignment review requested',
            description: $triggerReason ?? ucfirst($trigger).' trigger.',
            severity: 'warning',
            companyId: $session?->company_id,
            boardId: $session?->dispatch_board_id,
            sessionId: $session?->id,
            assignmentId: $assignment->id,
            actorId: $actorId,
            actorName: $actorName,
        );

        return $review;
    }

    public function approve(
        AssignmentReview $review,
        ?string $reason = null,
        ?int $actorId = null,
        ?string $actorName = null,
    ): AssignmentReview {
        $this->assertTransition($review, ReviewStatus::Approved);

        if (! $review->canBeDecidedBy($actorId)) {
            throw DispatchOperationsException::reviewerMustDifferFromRequester();
        }

        $approved = $this->decide($review, ReviewStatus::Approved, $reason, $actorId, $actorName);

        $this->audit->record(
            action: DispatchAuditEntry::ACTION_REVIEW_APPROVED,
            reason: $reason,
            companyId: $approved->company_id,
            sessionId: $approved->dispatch_session_id,
            assignmentId: $approved->assignment_id,
            entityType: 'assignment_review',
            entityId: $approved->uuid,
            changes: ['trigger' => $approved->trigger],
            actorId: $actorId,
            actorName: $actorName,
        );

        return $approved;
    }

    public function reject(
        AssignmentReview $review,
        string $reason,
        ?int $actorId = null,
        ?string $actorName = null,
    ): AssignmentReview {
        $this->assertTransition($review, ReviewStatus::Rejected);

        if (trim($reason) === '') {
            throw DispatchOperationsException::reviewRejectionReasonRequired();
        }

        if (! $review->canBeDecidedBy($actorId)) {
            throw DispatchOperationsException::reviewerMustDifferFromRequester();
        }

        $rejected = $this->decide($review, ReviewStatus::Rejected, $reason, $actorId, $actorName);

        $this->audit->record(
            action: DispatchAuditEntry::ACTION_REVIEW_REJECTED,
            reason: $reason,
            companyId: $rejected->company_id,
            sessionId: $rejected->dispatch_session_id,
            assignmentId: $rejected->assignment_id,
            entityType: 'assignment_review',
            entityId: $rejected->uuid,
            changes: ['trigger' => $rejected->trigger],
            actorId: $actorId,
            actorName: $actorName,
        );

        return $rejected;
    }

    public function withdraw(AssignmentReview $review, ?string $reason = null): AssignmentReview
    {
        $this->assertTransition($review, ReviewStatus::Withdrawn);

        return $this->decide($review, ReviewStatus::Withdrawn, $reason, null, null);
    }

    /** Whether an assignment is cleared to proceed. */
    public function isCleared(DispatchProposedAssignment $assignment): bool
    {
        $pending = AssignmentReview::query()
            ->where('assignment_id', $assignment->id)
            ->where('status', ReviewStatus::Pending->value)
            ->exists();

        return ! $pending;
    }

    public function assertCleared(DispatchProposedAssignment $assignment): void
    {
        if (! $this->isCleared($assignment)) {
            throw DispatchOperationsException::reviewPending();
        }
    }

    /** @return \Illuminate\Support\Collection<int, AssignmentReview> */
    public function pending(?string $companyId = null): \Illuminate\Support\Collection
    {
        return AssignmentReview::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->where('status', ReviewStatus::Pending->value)
            ->with('assignment')
            ->orderBy('requested_at')
            ->get();
    }

    private function decide(
        AssignmentReview $review,
        ReviewStatus $status,
        ?string $reason,
        ?int $actorId,
        ?string $actorName,
    ): AssignmentReview {
        $decided = DB::transaction(function () use ($review, $status, $reason, $actorId, $actorName) {
            $review->update([
                'status' => $status->value,
                'decided_at' => Carbon::now(),
                'decided_by' => $actorId,
                'decided_by_name' => $actorName,
                'decision_reason' => $reason,
                // Frees the one-open-review-per-assignment slot.
                'active_flag' => null,
            ]);

            return $review->refresh();
        });

        $this->timeline->record(
            eventType: DispatchTimelineEvent::TYPE_REVIEW_DECIDED,
            title: 'Assignment review '.$status->label(),
            description: $reason,
            severity: $status === ReviewStatus::Rejected ? 'warning' : 'info',
            companyId: $decided->company_id,
            sessionId: $decided->dispatch_session_id,
            assignmentId: $decided->assignment_id,
            actorId: $actorId,
            actorName: $actorName,
        );

        return $decided;
    }

    private function assertTransition(AssignmentReview $review, ReviewStatus $target): void
    {
        if (! $review->status->canTransitionTo($target)) {
            throw DispatchOperationsException::invalidReviewTransition($review->status, $target);
        }
    }
}
