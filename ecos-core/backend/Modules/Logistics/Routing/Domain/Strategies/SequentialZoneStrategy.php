<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Domain\Strategies;

use Modules\Logistics\Routing\Domain\Contracts\RoutingStrategyInterface;
use Modules\Logistics\Routing\Domain\ValueObjects\RouteLeg;
use Modules\Logistics\Routing\Domain\ValueObjects\RouteProposal;
use Modules\Logistics\Routing\Domain\ValueObjects\RouteRequest;
use Modules\Logistics\Routing\Domain\ValueObjects\RouteStop;

/**
 * THE DEFAULT STRATEGY.
 *
 * Sorts by zone, then city, then postcode — which is how dispatchers already
 * think about a city they know. It is the default rather than the sophisticated
 * option for two reasons:
 *
 *   1. It needs NO coordinates, so it is always available. A fleet with no
 *      geocoding still gets a sensible plan.
 *   2. An optimiser that produces theoretically shorter but practically worse
 *      routes gets overridden, and overrides become the norm within a
 *      fortnight. Starting from the familiar and MEASURING the uplift of
 *      anything smarter is how the smarter thing earns its place.
 *
 * Everything else is measured against this baseline (optimisation uplift).
 */
final class SequentialZoneStrategy implements RoutingStrategyInterface
{
    public function name(): string
    {
        return 'sequential_zone';
    }

    public function version(): string
    {
        return '1.0';
    }

    public function description(): string
    {
        return 'Zone, then city, then postcode. Needs no coordinates — the always-available baseline.';
    }

    /** Always. This is the fallback of last resort and must never refuse. */
    public function supports(RouteRequest $request): bool
    {
        return true;
    }

    public function optimize(RouteRequest $request): RouteProposal
    {
        $frozen = $request->frozenStops();
        $plannable = $request->plannableStops();

        usort($plannable, static function (RouteStop $a, RouteStop $b): int {
            return [$a->zoneId ?? '', $a->cityId ?? '', $a->postcode ?? '', $a->sequenceHint]
                <=> [$b->zoneId ?? '', $b->cityId ?? '', $b->postcode ?? '', $b->sequenceHint];
        });

        // Frozen stops keep their position at the front — a reroute plans the
        // remainder and never rewrites what already happened.
        $ordered = array_merge($frozen, $plannable);

        return LegBuilder::build($request, $ordered, $this->violationsFor($request));
    }

    /** @return list<string> */
    private function violationsFor(RouteRequest $request): array
    {
        $violations = [];

        $ungeocoded = count(array_filter(
            $request->plannableStops(),
            static fn (RouteStop $s) => ! $s->hasPoint(),
        ));

        if ($ungeocoded > 0) {
            // Reported, not hidden: distance figures are estimates when stops
            // have no coordinates, and the caller deserves to know.
            $violations[] = sprintf(
                '%d stop(s) have no coordinates — distance and duration are sequence-based estimates.',
                $ungeocoded,
            );
        }

        return $violations;
    }
}
