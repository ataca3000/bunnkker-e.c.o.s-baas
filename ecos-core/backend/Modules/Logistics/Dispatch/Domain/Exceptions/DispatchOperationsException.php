<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Exceptions;

use Modules\Logistics\Dispatch\Domain\Enums\AllocationStatus;
use Modules\Logistics\Dispatch\Domain\Enums\ConflictStatus;
use Modules\Logistics\Dispatch\Domain\Enums\DispatchSessionStatus;
use Modules\Logistics\Dispatch\Domain\Enums\QueueItemStatus;
use Modules\Logistics\Dispatch\Domain\Enums\ReviewStatus;

/**
 * Phase 3 failures.
 *
 * ADDITIVE: extends the Phase 2 DispatchException rather than modifying it, so
 * every existing catch block keeps working unchanged (Directive 14).
 */
class DispatchOperationsException extends DispatchException
{
    // ── Sessions ──────────────────────────────────────────────────────────────

    public static function invalidSessionTransition(
        DispatchSessionStatus $from,
        DispatchSessionStatus $to,
    ): self {
        $allowed = array_map(
            static fn (DispatchSessionStatus $s) => $s->label(),
            $from->allowedTransitions(),
        );

        return new self(sprintf(
            'A dispatch session cannot move from %s to %s. Allowed next states: %s.',
            $from->label(),
            $to->label(),
            $allowed === [] ? 'none — this session is finished' : implode(', ', $allowed),
        ));
    }

    public static function sessionAlreadyOpen(string $operator): self
    {
        return new self(
            "{$operator} already has an open session on this board. Close it before opening another — "
            .'two sessions by the same operator would split the audit trail.'
        );
    }

    // ── Queue ─────────────────────────────────────────────────────────────────

    public static function invalidQueueTransition(QueueItemStatus $from, QueueItemStatus $to): self
    {
        $allowed = array_map(static fn (QueueItemStatus $s) => $s->label(), $from->allowedTransitions());

        return new self(sprintf(
            'A queue item cannot move from %s to %s. Allowed next states: %s.',
            $from->label(),
            $to->label(),
            $allowed === [] ? 'none — this item is finished' : implode(', ', $allowed),
        ));
    }

    public static function queueItemAlreadyClaimed(string $bySession): self
    {
        return new self("That queue item is already claimed by {$bySession}.");
    }

    public static function queueItemNotClaimedBySession(): self
    {
        return new self('That queue item is claimed by a different session.');
    }

    // ── Allocation ────────────────────────────────────────────────────────────

    public static function invalidAllocationTransition(
        AllocationStatus $from,
        AllocationStatus $to,
    ): self {
        $allowed = array_map(static fn (AllocationStatus $s) => $s->label(), $from->allowedTransitions());

        return new self(sprintf(
            'An allocation cannot move from %s to %s. Allowed next states: %s.',
            $from->label(),
            $to->label(),
            $allowed === [] ? 'none — this allocation is final' : implode(', ', $allowed),
        ));
    }

    /** @param list<string> $reasons */
    public static function allocationBlocked(array $reasons): self
    {
        return new self('This allocation is blocked: '.implode(' ', $reasons));
    }

    public static function allocationNeedsBothResources(): self
    {
        return new self('An allocation needs both a vehicle and a driver.');
    }

    // ── Conflicts ─────────────────────────────────────────────────────────────

    public static function invalidConflictTransition(ConflictStatus $from, ConflictStatus $to): self
    {
        $allowed = array_map(static fn (ConflictStatus $s) => $s->label(), $from->allowedTransitions());

        return new self(sprintf(
            'A conflict cannot move from %s to %s. Allowed next states: %s.',
            $from->label(),
            $to->label(),
            $allowed === [] ? 'none — this conflict is closed' : implode(', ', $allowed),
        ));
    }

    /** @param list<string> $descriptions */
    public static function blockingConflictsOutstanding(array $descriptions): self
    {
        return new self(
            'Blocking conflicts must be resolved or overridden first: '.implode(' ', $descriptions)
        );
    }

    public static function conflictOverrideReasonRequired(): self
    {
        return new self(
            'Overriding a conflict clears it without fixing it, so it requires a recorded reason.'
        );
    }

    // ── Review ────────────────────────────────────────────────────────────────

    public static function invalidReviewTransition(ReviewStatus $from, ReviewStatus $to): self
    {
        $allowed = array_map(static fn (ReviewStatus $s) => $s->label(), $from->allowedTransitions());

        return new self(sprintf(
            'A review cannot move from %s to %s. Allowed next states: %s.',
            $from->label(),
            $to->label(),
            $allowed === [] ? 'none — this review is decided' : implode(', ', $allowed),
        ));
    }

    public static function reviewAlreadyOpen(): self
    {
        return new self('This assignment already has an open review.');
    }

    /** Separation of duties — the same rule LOG-005 applies to POD sign-off. */
    public static function reviewerMustDifferFromRequester(): self
    {
        return new self(
            'A conflict or override review must be decided by someone other than the person who '
            .'requested it.'
        );
    }

    public static function reviewRejectionReasonRequired(): self
    {
        return new self('Rejecting an assignment requires a reason.');
    }

    public static function reviewPending(): self
    {
        return new self('This assignment is awaiting review and cannot be released yet.');
    }

    // ── Locks ─────────────────────────────────────────────────────────────────

    public static function sessionNotActive(string $status): self
    {
        return new self("This dispatch session is {$status} and cannot claim resources.");
    }

    public static function resourceLocked(string $resourceType, string $holder, int $secondsLeft): self
    {
        return new self(sprintf(
            'That %s is held by %s for another %d second(s).',
            $resourceType,
            $holder,
            max(0, $secondsLeft),
        ));
    }

    public static function lockBreakReasonRequired(): self
    {
        return new self(
            'Force-releasing another session\'s lock requires a reason — it takes a resource from '
            .'a colleague mid-decision.'
        );
    }

    // ── Audit ─────────────────────────────────────────────────────────────────

    public static function auditReasonRequired(string $action): self
    {
        return new self("The action \"{$action}\" cannot be recorded without a reason.");
    }
}
