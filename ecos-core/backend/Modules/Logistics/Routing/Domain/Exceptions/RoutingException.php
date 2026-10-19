<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Domain\Exceptions;

use Modules\Logistics\Routing\Domain\Enums\RoutePlanStatus;
use RuntimeException;

/** Raised when an operation would violate a Routing business rule. Rendered as 422. */
class RoutingException extends RuntimeException
{
    public static function invalidPlanTransition(RoutePlanStatus $from, RoutePlanStatus $to): self
    {
        $allowed = array_map(static fn (RoutePlanStatus $s) => $s->label(), $from->allowedTransitions());

        return new self(sprintf(
            'A route plan cannot move from %s to %s. Allowed next states: %s.',
            $from->label(),
            $to->label(),
            $allowed === [] ? 'none — this state is terminal' : implode(', ', $allowed),
        ));
    }

    public static function tripHasNoStops(): self
    {
        return new self('This trip has no stops to route. Generate its stops first.');
    }

    public static function optimizationFailed(string $strategy, string $reason): self
    {
        return new self("The {$strategy} strategy could not produce a plan: {$reason}");
    }

    /**
     * The rule that stops a reroute rewriting history: a stop that has already
     * been attempted keeps its position.
     */
    public static function frozenStopsReordered(): self
    {
        return new self(
            'A reroute may not move a stop that has already been attempted. Only the remaining '
            .'stops can be re-sequenced.'
        );
    }

    public static function unknownStrategy(string $name): self
    {
        return new self("No routing strategy is registered under \"{$name}\".");
    }
}
