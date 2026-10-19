<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Domain\Strategies;

use Modules\Logistics\Routing\Domain\ValueObjects\RouteLeg;
use Modules\Logistics\Routing\Domain\ValueObjects\RouteProposal;
use Modules\Logistics\Routing\Domain\ValueObjects\RouteRequest;
use Modules\Logistics\Routing\Domain\ValueObjects\RouteStop;

/**
 * Turns an ordered stop list into legs, distances and durations.
 *
 * Shared by every strategy so they differ only in ORDERING, which is the thing
 * a strategy is actually for. Pure and static — no state, no I/O, safe under
 * the purity contract.
 */
final class LegBuilder
{
    /**
     * Fallback distance when a hop has no coordinates. A flat estimate is
     * honest about being an estimate; a zero would silently claim the vehicle
     * teleported and corrupt every distance KPI downstream.
     */
    private const ASSUMED_HOP_KM = 3.0;

    /**
     * @param  list<RouteStop>  $ordered
     * @param  list<string>  $violations
     */
    public static function build(RouteRequest $request, array $ordered, array $violations = []): RouteProposal
    {
        $legs = [];
        $sequence = [];
        $totalKm = 0.0;
        $totalMinutes = 0;

        $previous = null;
        $previousPoint = $request->origin;
        $index = 0;

        foreach ($ordered as $stop) {
            $index++;
            $sequence[] = $stop->stopId;

            $distance = self::hopDistance($previousPoint, $stop);
            $travelMinutes = self::travelMinutes($distance, $request->averageSpeedKmh);
            $serviceMinutes = $stop->serviceMinutes ?? $request->defaultServiceMinutes;

            $legs[] = new RouteLeg(
                fromStopId: $previous?->stopId,
                toStopId: $stop->stopId,
                sequence: $index,
                distanceKm: $distance,
                durationMinutes: $travelMinutes,
            );

            $totalKm += $distance;
            $totalMinutes += $travelMinutes + $serviceMinutes;

            $previous = $stop;
            $previousPoint = $stop->point ?? $previousPoint;
        }

        return new RouteProposal(
            sequence: $sequence,
            legs: $legs,
            totalDistanceKm: round($totalKm, 2),
            totalDurationMinutes: $totalMinutes,
            violations: $violations,
            confidence: self::confidence($ordered),
        );
    }

    private static function hopDistance(?object $fromPoint, RouteStop $to): float
    {
        if ($fromPoint === null || $to->point === null) {
            return self::ASSUMED_HOP_KM;
        }

        return $fromPoint->distanceTo($to->point);
    }

    private static function travelMinutes(float $distanceKm, float $averageSpeedKmh): int
    {
        if ($averageSpeedKmh <= 0.0) {
            return 0;
        }

        return (int) ceil(($distanceKm / $averageSpeedKmh) * 60);
    }

    /**
     * How much to trust the numbers: the share of stops that actually had
     * coordinates. Surfacing uncertainty beats presenting false precision.
     *
     * @param  list<RouteStop>  $ordered
     */
    private static function confidence(array $ordered): float
    {
        if ($ordered === []) {
            return 1.0;
        }

        $geocoded = count(array_filter($ordered, static fn (RouteStop $s) => $s->hasPoint()));

        return round($geocoded / count($ordered), 3);
    }
}
