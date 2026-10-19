<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Exceptions;

use Modules\Logistics\Dispatch\Domain\Enums\AssignmentStatus;
use Modules\Logistics\Dispatch\Domain\Enums\DispatchBoardStatus;
use Modules\Logistics\Dispatch\Domain\Enums\ProposalStatus;
use RuntimeException;

/** Raised when an operation would violate a Dispatch business rule. Rendered as 422. */
class DispatchException extends RuntimeException
{
    public static function invalidBoardTransition(DispatchBoardStatus $from, DispatchBoardStatus $to): self
    {
        $allowed = array_map(static fn (DispatchBoardStatus $s) => $s->label(), $from->allowedTransitions());

        return new self(sprintf(
            'A dispatch board cannot move from %s to %s. Allowed next states: %s.',
            $from->label(),
            $to->label(),
            $allowed === [] ? 'none — this state is terminal' : implode(', ', $allowed),
        ));
    }

    public static function invalidProposalTransition(ProposalStatus $from, ProposalStatus $to): self
    {
        $allowed = array_map(static fn (ProposalStatus $s) => $s->label(), $from->allowedTransitions());

        return new self(sprintf(
            'A proposal cannot move from %s to %s. Allowed next states: %s.',
            $from->label(),
            $to->label(),
            $allowed === [] ? 'none — this proposal is already decided' : implode(', ', $allowed),
        ));
    }

    public static function invalidAssignmentTransition(AssignmentStatus $from, AssignmentStatus $to): self
    {
        $allowed = array_map(static fn (AssignmentStatus $s) => $s->label(), $from->allowedTransitions());

        return new self(sprintf(
            'An assignment cannot move from %s to %s. Allowed next states: %s.',
            $from->label(),
            $to->label(),
            $allowed === [] ? 'none — this state is final' : implode(', ', $allowed),
        ));
    }

    public static function boardAlreadyExists(string $date): self
    {
        return new self("A dispatch board already exists for that origin on {$date}.");
    }

    public static function proposalAlreadyDecided(): self
    {
        return new self(
            'This proposal has already been decided. Generate a new one instead — a decided '
            .'proposal is immutable so the board stays explainable.'
        );
    }

    public static function nothingToRelease(): self
    {
        return new self('No assignment on this proposal is ready to release.');
    }

    public static function proposalNotAccepted(): self
    {
        return new self('A proposal must be accepted before it can be released.');
    }

    /**
     * Directive 5/6: V1 refused. Dispatch does NOT get a second opinion — it
     * surfaces V1's own message and records the failure.
     */
    public static function v1Refused(string $message): self
    {
        return new self("The change was refused by the owning module: {$message}");
    }

    /** @param list<string> $blockers */
    public static function assignmentBlocked(array $blockers): self
    {
        return new self('This assignment is blocked: '.implode(' ', $blockers));
    }

    public static function overrideReasonRequired(): self
    {
        return new self('Overriding a blocked assignment requires a reason.');
    }
}
