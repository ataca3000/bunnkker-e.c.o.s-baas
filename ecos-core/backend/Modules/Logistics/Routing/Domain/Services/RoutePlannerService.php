<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Logistics\Distribution\Domain\Models\DeliveryStop;
use Modules\Logistics\Distribution\Domain\Models\Trip;
use Modules\Logistics\Routing\Domain\Enums\RoutePlanStatus;
use Modules\Logistics\Routing\Domain\Events\RouteOptimizationFailed;
use Modules\Logistics\Routing\Domain\Events\RoutePlanned;
use Modules\Logistics\Routing\Domain\Events\RoutePlanSuperseded;
use Modules\Logistics\Routing\Domain\Exceptions\RoutingException;
use Modules\Logistics\Routing\Domain\Models\OptimizationRun;
use Modules\Logistics\Routing\Domain\Models\RouteLeg as RouteLegModel;
use Modules\Logistics\Routing\Domain\Models\RoutePlan;
use Modules\Logistics\Routing\Domain\Models\RouteStopRef;
use Modules\Logistics\Routing\Domain\ValueObjects\GeoPoint;
use Modules\Logistics\Routing\Domain\ValueObjects\RouteLeg;
use Modules\Logistics\Routing\Domain\ValueObjects\RouteRequest;
use Modules\Logistics\Routing\Domain\ValueObjects\RouteStop;
use Throwable;

/**
 * The PLANNING ENGINE: gathers the snapshot, runs a strategy, persists the plan.
 *
 * Splitting planning (all the I/O) from optimisation (none) is what makes the
 * whole thing testable — and it is why the strategy can stay pure.
 *
 * Distribution owns the trip and its stops. This service READS them and writes
 * only routing_* tables (Directives 6 and 11).
 */
class RoutePlannerService
{
    public function __construct(
        private readonly RoutingStrategyResolver $resolver,
        private readonly EtaEngine $eta,
    ) {}

    /**
     * Build a plan for a trip.
     *
     * A reroute is the same call: already-attempted stops are detected and
     * frozen, so only the remainder is re-sequenced.
     */
    public function plan(
        Trip $trip,
        ?string $preferredStrategy = null,
        ?int $actorId = null,
        ?string $actor = null,
    ): RoutePlan {
        $request = $this->buildRequest($trip);

        if ($request->stopCount() === 0) {
            throw RoutingException::tripHasNoStops();
        }

        $strategy = $this->resolver->resolve($request, $preferredStrategy);
        $current = $this->currentPlanFor($trip);

        $startedAt = microtime(true);

        try {
            $proposal = $strategy->optimize($request);
        } catch (Throwable $e) {
            $run = OptimizationRun::create([
                'company_id' => $trip->company_id,
                'strategy' => $strategy->name(),
                'strategy_version' => $strategy->version(),
                'succeeded' => false,
                'failure_reason' => $e->getMessage(),
                'request_snapshot' => $request->toArray(),
                'stop_count' => $request->stopCount(),
                'duration_ms' => (int) round((microtime(true) - $startedAt) * 1000),
                'created_by' => $actorId,
            ]);

            RouteOptimizationFailed::dispatch($run, $actor);

            throw RoutingException::optimizationFailed($strategy->name(), $e->getMessage());
        }

        $durationMs = (int) round((microtime(true) - $startedAt) * 1000);

        $plan = DB::transaction(function () use (
            $trip, $request, $strategy, $proposal, $current, $durationMs, $actorId
        ) {
            $plan = RoutePlan::create([
                'company_id' => $trip->company_id,
                'trip_id' => $trip->id,
                'status' => RoutePlanStatus::Planned->value,
                'strategy' => $strategy->name(),
                'strategy_version' => $strategy->version(),
                'total_distance_km' => $proposal->totalDistanceKm,
                'total_duration_minutes' => $proposal->totalDurationMinutes,
                'stop_count' => $proposal->stopCount(),
                'confidence' => $proposal->confidence,
                'planned_at' => Carbon::now(),
                'created_by' => $actorId,
            ]);

            $refs = $this->persistStops($plan, $request, $proposal->sequence);
            $this->persistLegs($plan, $proposal->legs, $refs);

            OptimizationRun::create([
                'route_plan_id' => $plan->id,
                'company_id' => $trip->company_id,
                'strategy' => $strategy->name(),
                'strategy_version' => $strategy->version(),
                'succeeded' => true,
                // The replay harness and, later, the AI training corpus.
                'request_snapshot' => $request->toArray(),
                'proposal_summary' => $proposal->toArray(),
                'constraint_violations' => $proposal->violations === [] ? null : $proposal->violations,
                'duration_ms' => $durationMs,
                'stop_count' => $proposal->stopCount(),
                'created_by' => $actorId,
            ]);

            // Supersede, never edit — the old plan stays readable.
            if ($current !== null) {
                if (! $current->preservesFrozenOrder($plan)) {
                    throw RoutingException::frozenStopsReordered();
                }

                $current->update([
                    'status' => RoutePlanStatus::Superseded->value,
                    'superseded_by_plan_id' => $plan->id,
                    'supersede_reason' => 'Replaced by a newer plan.',
                ]);
            }

            return $plan->refresh();
        });

        if ($current !== null) {
            RoutePlanSuperseded::dispatch($current->refresh(), $actor);
        }

        $this->eta->project($plan);

        RoutePlanned::dispatch($plan->refresh(), $actor);

        return $plan->refresh();
    }

    public function currentPlanFor(Trip $trip): ?RoutePlan
    {
        return RoutePlan::query()
            ->where('trip_id', $trip->id)
            ->whereNull('superseded_by_plan_id')
            ->whereIn('status', [
                RoutePlanStatus::Planned->value,
                RoutePlanStatus::Active->value,
            ])
            ->latest('id')
            ->first();
    }

    public function activate(RoutePlan $plan): RoutePlan
    {
        $this->assertTransition($plan, RoutePlanStatus::Active);

        $plan->update([
            'status' => RoutePlanStatus::Active->value,
            'activated_at' => Carbon::now(),
        ]);

        return $plan->refresh();
    }

    public function complete(RoutePlan $plan): RoutePlan
    {
        $this->assertTransition($plan, RoutePlanStatus::Completed);

        $plan->update([
            'status' => RoutePlanStatus::Completed->value,
            'completed_at' => Carbon::now(),
        ]);

        return $plan->refresh();
    }

    // ── Snapshot assembly ─────────────────────────────────────────────────────

    /**
     * Freeze the snapshot.
     *
     * Coordinates come from D1's nullable latitude/longitude on
     * logistics_cities. A stop whose city has no coordinate simply has no
     * point, and the sequential strategy handles it.
     */
    public function buildRequest(Trip $trip): RouteRequest
    {
        $stops = DeliveryStop::query()
            ->where('trip_id', $trip->id)
            ->orderBy('id')
            ->get();

        $cityCoords = $this->cityCoordinates($stops);
        $attemptedStopIds = $this->attemptedStopIds($stops->pluck('id')->all());

        $routeStops = $stops->map(function (DeliveryStop $stop) use ($cityCoords, $attemptedStopIds) {
            $cityId = $stop->city_id ?? null;
            $coords = $cityId !== null ? ($cityCoords[$cityId] ?? null) : null;

            return new RouteStop(
                stopId: $stop->id,
                point: $coords,
                zoneId: isset($stop->distribution_zone_id) ? (string) $stop->distribution_zone_id : null,
                cityId: $cityId !== null ? (string) $cityId : null,
                postcode: $stop->postcode ?? null,
                isFrozen: in_array($stop->id, $attemptedStopIds, true),
                sequenceHint: (int) ($stop->sequence ?? $stop->id),
            );
        })->values()->all();

        return new RouteRequest(
            tripId: $trip->id,
            origin: null,
            stops: $routeStops,
            constraints: [
                'trip_capacity' => $trip->capacity,
            ],
        );
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /**
     * @param  \Illuminate\Support\Collection<int, DeliveryStop>  $stops
     * @return array<string, GeoPoint>
     */
    private function cityCoordinates(\Illuminate\Support\Collection $stops): array
    {
        $cityIds = $stops->pluck('city_id')->filter()->unique()->values();

        if ($cityIds->isEmpty()) {
            return [];
        }

        return DB::table('logistics_cities')
            ->whereIn('id', $cityIds)
            ->get(['id', 'latitude', 'longitude'])
            ->mapWithKeys(static fn ($row) => [
                (string) $row->id => GeoPoint::fromNullable($row->latitude, $row->longitude),
            ])
            ->filter()
            ->all();
    }

    /**
     * Stops that already have a delivery attempt. These are FROZEN — a reroute
     * plans the remainder and never rewrites history.
     *
     * A read of a delivery_* table, never a write.
     *
     * @param  list<int>  $stopIds
     * @return list<int>
     */
    private function attemptedStopIds(array $stopIds): array
    {
        if ($stopIds === [] || ! \Illuminate\Support\Facades\Schema::hasTable('delivery_attempts')) {
            return [];
        }

        return DB::table('delivery_attempts')
            ->whereIn('stop_id', $stopIds)
            ->distinct()
            ->pluck('stop_id')
            ->map(static fn ($id) => (int) $id)
            ->all();
    }

    /**
     * @param  list<int>  $sequence
     * @return array<int, RouteStopRef>  Keyed by stop id
     */
    private function persistStops(RoutePlan $plan, RouteRequest $request, array $sequence): array
    {
        $frozen = [];
        foreach ($request->stops as $stop) {
            $frozen[$stop->stopId] = $stop->isFrozen;
        }

        $refs = [];
        $position = 0;

        foreach ($sequence as $stopId) {
            $position++;

            $refs[$stopId] = RouteStopRef::create([
                'route_plan_id' => $plan->id,
                'stop_id' => $stopId,
                'sequence' => $position,
                'is_frozen' => $frozen[$stopId] ?? false,
            ]);
        }

        return $refs;
    }

    /**
     * @param  list<RouteLeg>  $legs
     * @param  array<int, RouteStopRef>  $refs
     */
    private function persistLegs(RoutePlan $plan, array $legs, array $refs): void
    {
        foreach ($legs as $leg) {
            RouteLegModel::create([
                'route_plan_id' => $plan->id,
                'sequence' => $leg->sequence,
                'from_stop_ref_id' => $leg->fromStopId !== null
                    ? ($refs[$leg->fromStopId]->id ?? null)
                    : null,
                'to_stop_ref_id' => $refs[$leg->toStopId]->id ?? null,
                'distance_km' => $leg->distanceKm,
                'duration_minutes' => $leg->durationMinutes,
            ]);
        }
    }

    private function assertTransition(RoutePlan $plan, RoutePlanStatus $target): void
    {
        if (! $plan->status->canTransitionTo($target)) {
            throw RoutingException::invalidPlanTransition($plan->status, $target);
        }
    }
}
