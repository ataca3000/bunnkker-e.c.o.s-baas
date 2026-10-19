<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Domain\Exceptions;

use Modules\Logistics\Distribution\Domain\Enums\SettlementStatus;
use Modules\Logistics\Distribution\Domain\Enums\TripStatus;
use RuntimeException;

/**
 * Raised when an operation would violate a Distribution business rule.
 * The presentation layer renders these as HTTP 422.
 */
class DistributionException extends RuntimeException
{
    public static function invalidTripTransition(TripStatus $from, TripStatus $to): self
    {
        $allowed = array_map(static fn (TripStatus $s) => $s->label(), $from->allowedTransitions());

        return new self(sprintf(
            'A trip cannot move from %s to %s. Allowed next states: %s.',
            $from->label(),
            $to->label(),
            $allowed === [] ? 'none — this state is terminal' : implode(', ', $allowed),
        ));
    }

    public static function tripNotEditable(TripStatus $status): self
    {
        return new self(sprintf(
            'Orders and custody can only be changed while a trip is in Planning or Loading. This trip is %s.',
            $status->label(),
        ));
    }

    public static function tripAtCapacity(int $capacity): self
    {
        return new self("This trip is already at its capacity of {$capacity} orders.");
    }

    public static function orderAlreadyOnAnotherTrip(string $tripNumber): self
    {
        return new self("That order is already assigned to trip {$tripNumber}. Remove it from that trip first.");
    }

    public static function dispatchBlocked(array $reasons): self
    {
        return new self('This trip cannot be dispatched: '.implode(' ', $reasons));
    }

    public static function assignmentNotActive(): self
    {
        return new self('The selected driver/vehicle assignment is not active.');
    }

    public static function deliveryNotOnTheRoad(TripStatus $status): self
    {
        return new self(sprintf(
            'Deliveries can only be recorded while the trip is on the road. This trip is %s.',
            $status->label(),
        ));
    }

    public static function stopAlreadySettled(): self
    {
        return new self('This stop has already reached an outcome and cannot be re-completed.');
    }

    public static function paymentNotAllowedForStop(): self
    {
        return new self('Payment can only be recorded against a delivered or partially delivered stop.');
    }

    public static function settlementRequiresCompletion(): self
    {
        return new self('A trip can only be settled once every stop has reached an outcome.');
    }

    public static function invalidSettlementTransition(SettlementStatus $from, SettlementStatus $to): self
    {
        $allowed = array_map(static fn (SettlementStatus $s) => $s->label(), $from->allowedTransitions());

        return new self(sprintf(
            'A settlement cannot move from %s to %s. Allowed next states: %s.',
            $from->label(),
            $to->label(),
            $allowed === [] ? 'none — this settlement is final' : implode(', ', $allowed),
        ));
    }

    public static function settlementFinal(): self
    {
        return new self('This settlement is finalized and can no longer be changed.');
    }
}
