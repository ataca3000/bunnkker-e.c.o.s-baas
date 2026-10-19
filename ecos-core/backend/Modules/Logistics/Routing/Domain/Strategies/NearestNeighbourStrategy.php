<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Domain\Strategies;

use Modules\Logistics\Routing\Domain\Contracts\RoutingStrategyInterface;
use Modules\Logistics\Routing\Domain\ValueObjects\GeoPoint;
use Modules\Logistics\Routing\Domain\ValueObjects\RouteProposal;
use Modules\Logistics\Routing\Domain\ValueObjects\RouteRequest;
use Modules\Logistics\Routing\Domain\ValueObjects\RouteStop;

/**
 * Greedy nearest-neighbour with a 2-opt improvement pass.
 *
 * Deterministic — no randomness, no learning, no AI. Given the same request it
 * always produces the same tour, which is what the purity contract requires and
 * what makes the optimisation-uplift KPI meaningful against the sequential
 * baseline.
 *
 * Refuses (supports() === false) when the stops are not fully geocoded, and the
 * resolver falls through to SequentialZoneStrategy. Refusing is the honest
 * answer: a geometric strategy fed guessed distances produces a confidently
 * wrong tour.
 */
final class NearestNeighbourStrategy implements RoutingStrategyInterface
{
    /**
     * 2-opt is O(n²) per pass. Above this many stops the improvement is not
     * worth the wall clock inside a synchronous request, so the greedy tour
     * stands. Documented rather than silent — see the violation it emits.
     */
    private const TWO_OPT_MAX_STOPS = 60;

    public function name(): string
    {
        return 'nearest_neighbour';
    }

    public function version(): string
    {
        return '1.0';
    }

    public function description(): string
    {
        return 'Greedy nearest-neighbour with 2-opt. Deterministic; needs coordinates on every stop.';
    }

    public function supports(RouteRequest $request): bool
    {
        return $request->isFullyGeocoded() && $request->origin !== null;
    }

    public function optimize(RouteRequest $request): RouteProposal
    {
        $frozen = $request->frozenStops();
        $remaining = $request->plannableStops();

        // The tour starts wherever the frozen prefix left off, not at the depot,
        // so a reroute continues from the driver's actual position in the plan.
        $cursor = $this->lastPointOf($frozen) ?? $request->origin;

        $tour = [];

        while ($remaining !== []) {
            $bestIndex = 0;
            $bestDistance = PHP_FLOAT_MAX;

            foreach ($remaining as $i => $stop) {
                $distance = $cursor !== null && $stop->point !== null
                    ? $cursor->distanceTo($stop->point)
                    : PHP_FLOAT_MAX;

                if ($distance < $bestDistance) {
                    $bestDistance = $distance;
                    $bestIndex = $i;
                }
            }

            $chosen = $remaining[$bestIndex];
            $tour[] = $chosen;
            $cursor = $chosen->point ?? $cursor;

            array_splice($remaining, $bestIndex, 1);
        }

        $violations = [];

        if (count($tour) <= self::TWO_OPT_MAX_STOPS) {
            $tour = $this->twoOpt($tour, $request->origin);
        } else {
            // No silent caps: if we skipped the improvement pass, say so.
            $violations[] = sprintf(
                '2-opt improvement skipped above %d stops; the greedy tour was used.',
                self::TWO_OPT_MAX_STOPS,
            );
        }

        return LegBuilder::build($request, array_merge($frozen, $tour), $violations);
    }

    /**
     * Classic 2-opt: repeatedly reverse a segment when doing so shortens the
     * tour. Terminates when a full pass finds no improvement.
     *
     * @param  list<RouteStop>  $tour
     * @return list<RouteStop>
     */
    private function twoOpt(array $tour, ?GeoPoint $origin): array
    {
        $count = count($tour);

        if ($count < 4) {
            return $tour;
        }

        $improved = true;

        while ($improved) {
            $improved = false;

            for ($i = 0; $i < $count - 1; $i++) {
                for ($j = $i + 1; $j < $count; $j++) {
                    $before = $this->tourLength($tour, $origin);

                    $candidate = $tour;
                    $segment = array_slice($candidate, $i, $j - $i + 1);
                    array_splice($candidate, $i, $j - $i + 1, array_reverse($segment));

                    if ($this->tourLength($candidate, $origin) < $before - 0.0001) {
                        $tour = $candidate;
                        $improved = true;
                    }
                }
            }
        }

        return $tour;
    }

    /** @param list<RouteStop> $tour */
    private function tourLength(array $tour, ?GeoPoint $origin): float
    {
        $total = 0.0;
        $cursor = $origin;

        foreach ($tour as $stop) {
            if ($cursor !== null && $stop->point !== null) {
                $total += $cursor->distanceTo($stop->point);
            }

            $cursor = $stop->point ?? $cursor;
        }

        return $total;
    }

    /** @param list<RouteStop> $stops */
    private function lastPointOf(array $stops): ?GeoPoint
    {
        for ($i = count($stops) - 1; $i >= 0; $i--) {
            if ($stops[$i]->point !== null) {
                return $stops[$i]->point;
            }
        }

        return null;
    }
}
