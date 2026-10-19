<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Exceptions;

use Modules\Logistics\Delivery\Domain\Enums\AttemptStatus;
use Modules\Logistics\Delivery\Domain\Enums\CodStatus;
use Modules\Logistics\Delivery\Domain\Enums\DeliveryReturnStatus;
use Modules\Logistics\Delivery\Domain\Enums\DeliveryStatus;
use Modules\Logistics\Delivery\Domain\Enums\PodStatus;
use RuntimeException;

/** Raised when an operation would violate a Delivery OS business rule. */
class DeliveryException extends RuntimeException
{
    public static function invalidDeliveryTransition(DeliveryStatus $from, DeliveryStatus $to): self
    {
        $allowed = array_map(static fn (DeliveryStatus $s) => $s->label(), $from->allowedTransitions());

        return new self(sprintf(
            'A delivery cannot move from %s to %s. Allowed next states: %s.',
            $from->label(),
            $to->label(),
            $allowed === [] ? 'none — this state is terminal' : implode(', ', $allowed),
        ));
    }

    public static function invalidCodTransition(CodStatus $from, CodStatus $to): self
    {
        $allowed = array_map(static fn (CodStatus $s) => $s->label(), $from->allowedTransitions());

        return new self(sprintf(
            'A COD record cannot move from %s to %s. Allowed next states: %s.',
            $from->label(),
            $to->label(),
            $allowed === [] ? 'none — this state is final' : implode(', ', $allowed),
        ));
    }

    public static function invalidAttemptTransition(AttemptStatus $from, AttemptStatus $to): self
    {
        $allowed = array_map(static fn (AttemptStatus $s) => $s->label(), $from->allowedTransitions());

        return new self(sprintf(
            'An attempt cannot move from %s to %s. Allowed next states: %s.',
            $from->label(),
            $to->label(),
            $allowed === [] ? 'none — this attempt is closed' : implode(', ', $allowed),
        ));
    }

    public static function attemptAlreadyOpen(): self
    {
        return new self('This delivery already has an open attempt. Close it before opening another.');
    }

    public static function deliveryNotAcceptingAttempts(DeliveryStatus $status): self
    {
        return new self(sprintf(
            'A new attempt cannot be opened while the delivery is %s.',
            $status->label(),
        ));
    }

    public static function retryBlocked(array $reasons): self
    {
        return new self('This delivery cannot be retried: '.implode(' ', $reasons));
    }

    public static function tripNotOnTheRoad(): self
    {
        return new self('An attempt can only be executed from a trip that is on the road.');
    }

    public static function driverCannotDeliver(): self
    {
        return new self('The assigned driver cannot start deliveries (licence or status).');
    }

    public static function vehicleCannotDeliver(): self
    {
        return new self('The assigned vehicle cannot be dispatched (status, licence or insurance).');
    }

    public static function podRequired(array $missing): self
    {
        return new self(
            'Proof of delivery is incomplete. Missing: '.implode(', ', $missing).'.'
        );
    }

    public static function podNotValidated(): self
    {
        return new self('This delivery requires a validated proof of delivery before it can succeed.');
    }

    public static function invalidPodTransition(PodStatus $from, PodStatus $to): self
    {
        return new self(sprintf(
            'A proof of delivery cannot move from %s to %s.',
            $from->label(),
            $to->label(),
        ));
    }

    public static function podImmutable(): self
    {
        return new self('A validated proof of delivery can no longer be changed.');
    }

    public static function codOutstanding(float $amount, string $currency): self
    {
        return new self(sprintf(
            'Delivery cannot succeed while %s %s of COD is still outstanding.',
            $currency,
            number_format($amount, 2),
        ));
    }

    public static function codDisputed(): self
    {
        return new self('A disputed COD must be resolved before the delivery can be closed.');
    }

    public static function returnQuantityExceedsUndelivered(string $product): self
    {
        return new self("Returned quantity for {$product} exceeds the quantity the customer did not take.");
    }

    public static function invalidReturnTransition(DeliveryReturnStatus $from, DeliveryReturnStatus $to): self
    {
        return new self(sprintf(
            'A return cannot move from %s to %s.',
            $from->label(),
            $to->label(),
        ));
    }

    public static function partialDeliveryNeedsLines(): self
    {
        return new self('A partial delivery must declare which products were not accepted.');
    }
}
