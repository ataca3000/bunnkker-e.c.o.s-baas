<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Exceptions;

use Illuminate\Http\JsonResponse;
use Modules\Logistics\Operations\Domain\Enums\ExceptionSource;
use Modules\Logistics\Operations\Domain\Enums\ExceptionStatus;
use Modules\Logistics\Operations\Domain\Enums\PoolMemberStatus;
use Modules\Logistics\Operations\Domain\Enums\PoolStatus;
use Modules\Logistics\Operations\Domain\Enums\PoolType;
use Modules\Logistics\Operations\Domain\Enums\ReservationStatus;
use RuntimeException;

/**
 * A refusal an operator can act on.
 *
 * Every message names the thing that is wrong and, where another module made the
 * decision, says which one. "Operation failed" teaches nobody anything.
 */
class OperationsException extends RuntimeException
{
    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], 422);
    }

    // ── Pools ────────────────────────────────────────────────────────────────

    public static function invalidPoolTransition(PoolStatus $from, PoolStatus $to): self
    {
        return new self(
            "A {$from->label()} pool cannot become {$to->label()}."
        );
    }

    public static function poolNotUsable(PoolStatus $status): self
    {
        return new self(
            "This pool is {$status->label()} and cannot be drawn on. Activate it first."
        );
    }

    public static function memberTypeNotAccepted(PoolType $type, string $memberType): self
    {
        return new self(
            "A {$type->label()} pool does not hold {$memberType}s."
        );
    }

    public static function invalidMemberTransition(PoolMemberStatus $from, PoolMemberStatus $to): self
    {
        return new self(
            "A membership that is '{$from->label()}' cannot become '{$to->label()}'."
        );
    }

    public static function alreadyInPool(string $memberType, int $memberId): self
    {
        return new self(
            "That {$memberType} (#{$memberId}) is already in this pool."
        );
    }

    public static function withdrawalReasonRequired(): self
    {
        return new self(
            'Removing a resource from a pool needs a reason — otherwise nobody can tell later whether it should go back.'
        );
    }

    // ── Capacity ─────────────────────────────────────────────────────────────

    public static function invalidReservationTransition(ReservationStatus $from, ReservationStatus $to): self
    {
        return new self(
            "A {$from->label()} reservation cannot become {$to->label()}."
        );
    }

    public static function reservationQuantitiesRequired(): self
    {
        return new self('A reservation must ask for at least one unit of something.');
    }

    /** The ledger refused. Its words, not a paraphrase. */
    public static function ledgerRefused(string $ledgerMessage): self
    {
        return new self("Network refused the reservation: {$ledgerMessage}");
    }

    public static function releaseReasonRequired(): self
    {
        return new self(
            'Releasing confirmed capacity needs a reason. Someone has to own giving it back.'
        );
    }

    public static function nothingToRebalance(): self
    {
        return new self('That reservation is not holding capacity, so there is nothing to move.');
    }

    public static function rebalanceToSameSlot(): self
    {
        return new self('The reservation is already on that slot.');
    }

    // ── Exceptions ───────────────────────────────────────────────────────────

    public static function invalidExceptionTransition(ExceptionStatus $from, ExceptionStatus $to): self
    {
        return new self(
            "An exception that is {$from->label()} cannot become {$to->label()}."
        );
    }

    /**
     * Operations may record that a problem was handled, but it cannot declare
     * another module's fact untrue.
     */
    public static function notOurExceptionToResolve(ExceptionSource $source): self
    {
        return new self(
            "This exception belongs to {$source->label()}. Operations can acknowledge it and note what was done, but the underlying problem has to be cleared in {$source->label()}."
        );
    }

    public static function escalationReasonRequired(): self
    {
        return new self(
            'An escalation needs a reason. Handing someone a problem with no context is how escalations stall.'
        );
    }

    public static function alreadyAtTopEscalation(int $level): self
    {
        return new self("This exception is already escalated to level {$level}.");
    }

    public static function resolutionReasonRequired(): self
    {
        return new self('Closing an exception needs a note saying what was done.');
    }

    public static function noteBodyRequired(): self
    {
        return new self('An empty note helps nobody.');
    }
}
