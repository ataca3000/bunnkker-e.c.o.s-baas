<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Exceptions;

use RuntimeException;

/** Every way the recruitment domain refuses an instruction, named. */
final class RecruitmentException extends RuntimeException
{
    public static function jobNotAcceptingApplications(): self
    {
        return new self('This job opening is not accepting applications.');
    }

    public static function alreadyApplied(): self
    {
        return new self('This applicant has already applied to this opening.');
    }

    public static function invalidJobTransition(string $from, string $to): self
    {
        return new self("A job opening cannot move from {$from} to {$to}.");
    }

    public static function invalidApplicationTransition(string $from, string $to): self
    {
        return new self("An application cannot move from {$from} to {$to}.");
    }

    public static function noPipelineConfigured(): self
    {
        return new self('No recruitment stages are configured for this company.');
    }

    public static function stageNotInPipeline(): self
    {
        return new self('That stage does not belong to this company\'s pipeline.');
    }

    public static function notReadyToHire(string $status): self
    {
        return new self("An application that is {$status} cannot be hired; it must be accepted first.");
    }

    public static function alreadyHired(): self
    {
        return new self('This applicant has already been hired.');
    }

    public static function cannotMergeIntoSelf(): self
    {
        return new self('An applicant cannot be merged into themselves.');
    }

    public static function applicantAlreadyMerged(): self
    {
        return new self('This applicant has already been merged into another record.');
    }

    public static function interviewNotCompleted(): self
    {
        return new self('A decision can only be recorded on a completed interview.');
    }

    public static function contactRequired(): self
    {
        return new self('An applicant needs at least a mobile number to be reachable.');
    }

    // ── Offers ────────────────────────────────────────────────────────────────

    public static function offerAlreadyOpen(string $offerNumber): self
    {
        return new self("Offer {$offerNumber} is still open on this application; withdraw it before drafting another.");
    }

    public static function invalidOfferTransition(string $from, string $to): self
    {
        return new self("An offer cannot move from {$from} to {$to}.");
    }

    public static function offerNotRevisable(string $status): self
    {
        return new self("An offer that is {$status} can no longer be revised.");
    }

    public static function offerExpired(): self
    {
        return new self('This offer has passed its expiry date and can no longer be answered.');
    }

    public static function offerRequiredBeforeHiring(): self
    {
        return new self('Hiring requires an accepted offer. Draft an offer, send it, and record the candidate\'s acceptance first.');
    }

    // ── Tags ──────────────────────────────────────────────────────────────────

    public static function tagInUse(string $name): self
    {
        return new self("The tag \"{$name}\" is assigned to applicants and cannot be deleted; deactivate it instead.");
    }

    public static function tagNotInCatalogue(): self
    {
        return new self('That tag does not belong to this company\'s catalogue.');
    }

    // ── Bulk ──────────────────────────────────────────────────────────────────

    public static function bulkLimitExceeded(int $given, int $max): self
    {
        return new self("A bulk action covers at most {$max} applications at once; {$given} were selected.");
    }

    public static function unknownBulkAction(string $action): self
    {
        return new self("There is no bulk action called \"{$action}\".");
    }

    // ── Exit ──────────────────────────────────────────────────────────────────

    public static function exitAlreadyOpen(string $reference): self
    {
        return new self("This employee already has an open exit ({$reference}).");
    }

    public static function invalidExitTransition(string $from, string $to): self
    {
        return new self("An exit cannot move from {$from} to {$to}.");
    }

    public static function exitBlockedByChecklist(int $outstanding): self
    {
        return new self("This exit cannot be completed: {$outstanding} mandatory checklist item(s) are still outstanding.");
    }

    public static function waiverReasonRequired(): self
    {
        return new self('Waiving a checklist item requires a reason.');
    }

    public static function exitNotOpen(string $status): self
    {
        return new self("This exit is {$status}; its checklist can no longer be changed.");
    }
}
