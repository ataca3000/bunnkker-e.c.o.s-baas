<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Domain\ValueObjects;

/**
 * The IMMUTABLE SNAPSHOT a routing strategy is given.
 *
 * ┌─ DIRECTIVE 10 — STRATEGY PATTERN, PURITY CONTRACT ──────────────────────┐
 * │ Everything a strategy needs is in here. A strategy may not read a        │
 * │ repository, a cache or the clock, so the same request always produces    │
 * │ the same proposal.                                                       │
 * │                                                                          │
 * │ That is what makes a run replayable, a regression debuggable, and a      │
 * │ future AI strategy a drop-in rather than a redesign — and it is why the  │
 * │ whole snapshot is persisted on routing_optimization_runs.                │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class RouteRequest
{
    /**
     * @param  list<RouteStop>  $stops
     * @param  array<string, mixed>  $constraints
     */
    public function __construct(
        public readonly int $tripId,
        public readonly ?GeoPoint $origin,
        public readonly array $stops,
        public readonly array $constraints = [],
        public readonly string $objective = 'distance',
        public readonly float $averageSpeedKmh = 30.0,
        public readonly int $defaultServiceMinutes = 8,
    ) {}

    public function stopCount(): int
    {
        return count($this->stops);
    }

    /** Stops already attempted — frozen, and never re-sequenced. */
    public function frozenStops(): array
    {
        return array_values(array_filter($this->stops, static fn (RouteStop $s) => $s->isFrozen));
    }

    /** The remainder a reroute may re-plan. */
    public function plannableStops(): array
    {
        return array_values(array_filter($this->stops, static fn (RouteStop $s) => ! $s->isFrozen));
    }

    /**
     * Whether every plannable stop has a coordinate.
     *
     * Geometric strategies need this; sequential ones do not, which is exactly
     * why SequentialZoneStrategy is the always-available fallback.
     */
    public function isFullyGeocoded(): bool
    {
        foreach ($this->plannableStops() as $stop) {
            if ($stop->point === null) {
                return false;
            }
        }

        return true;
    }

    /** Persisted verbatim on the optimisation run — the replay harness. */
    public function toArray(): array
    {
        return [
            'trip_id' => $this->tripId,
            'origin' => $this->origin?->toArray(),
            'objective' => $this->objective,
            'average_speed_kmh' => $this->averageSpeedKmh,
            'default_service_minutes' => $this->defaultServiceMinutes,
            'constraints' => $this->constraints,
            'stops' => array_map(static fn (RouteStop $s) => $s->toArray(), $this->stops),
        ];
    }
}
