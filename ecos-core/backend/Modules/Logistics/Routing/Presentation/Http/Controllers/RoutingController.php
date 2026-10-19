<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Logistics\Distribution\Domain\Models\Trip;
use Modules\Logistics\Routing\Domain\Enums\RoutePlanStatus;
use Modules\Logistics\Routing\Domain\Exceptions\RoutingException;
use Modules\Logistics\Routing\Domain\Models\OptimizationRun;
use Modules\Logistics\Routing\Domain\Models\RoutePlan;
use Modules\Logistics\Routing\Domain\Services\EtaEngine;
use Modules\Logistics\Routing\Domain\Services\RoutePlannerService;
use Modules\Logistics\Routing\Domain\Services\RoutingStrategyResolver;
use Modules\Logistics\Routing\Presentation\Http\Resources\RoutePlanResource;

/**
 * Route plans, strategies and ETA.
 *
 * Phase 2 is deterministic only — no optimisation AI. The strategy catalogue is
 * published so a future implementation is a registration, not a redesign.
 */
class RoutingController extends Controller
{
    public function __construct(
        private readonly RoutePlannerService $planner,
        private readonly RoutingStrategyResolver $resolver,
        private readonly EtaEngine $eta,
    ) {}

    public function options(): JsonResponse
    {
        return response()->json([
            'plan_statuses' => RoutePlanStatus::options(),
            'strategies' => $this->resolver->catalogue(),
            'eta_refinement_levels' => [
                ['value' => 0, 'label' => 'Planned'],
                ['value' => 1, 'label' => 'Departure adjusted'],
                ['value' => 2, 'label' => 'Progress adjusted'],
                // L3 needs Telemetry, which is deferred to Phase 8 (D3).
                ['value' => 3, 'label' => 'Position adjusted (not available)'],
            ],
        ]);
    }

    public function strategies(): JsonResponse
    {
        return response()->json(['data' => $this->resolver->catalogue()]);
    }

    /** The current (non-superseded) plan for a trip. */
    public function currentPlan(string $tripId): JsonResponse|RoutePlanResource
    {
        $plan = $this->planner->currentPlanFor($this->trip($tripId));

        if ($plan === null) {
            return response()->json(['data' => null]);
        }

        return new RoutePlanResource($plan->load(['stopRefs.etaProjections', 'legs']));
    }

    /** Every plan for a trip, newest first — supersession stays readable. */
    public function planHistory(string $tripId): JsonResponse
    {
        $plans = RoutePlan::query()
            ->where('trip_id', $this->trip($tripId)->id)
            ->latest('id')
            ->get();

        return RoutePlanResource::collection($plans)->response();
    }

    /**
     * Plan or re-plan a trip.
     *
     * A reroute is the same call: already-attempted stops are frozen, so only
     * the remainder is re-sequenced.
     */
    public function plan(Request $request, string $tripId): JsonResponse
    {
        $validated = $request->validate([
            'strategy' => ['nullable', 'string', 'max:60'],
        ]);

        try {
            $plan = $this->planner->plan(
                $this->trip($tripId),
                $validated['strategy'] ?? null,
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (RoutingException $e) {
            return $this->unprocessable($e);
        }

        return (new RoutePlanResource($plan->load(['stopRefs.etaProjections', 'legs'])))
            ->response()
            ->setStatusCode(201);
    }

    public function activate(string $tripId, string $planId): JsonResponse|RoutePlanResource
    {
        try {
            $plan = $this->planner->activate($this->findPlan($tripId, $planId));
        } catch (RoutingException $e) {
            return $this->unprocessable($e);
        }

        return new RoutePlanResource($plan);
    }

    public function complete(string $tripId, string $planId): JsonResponse|RoutePlanResource
    {
        try {
            $plan = $this->planner->complete($this->findPlan($tripId, $planId));
        } catch (RoutingException $e) {
            return $this->unprocessable($e);
        }

        return new RoutePlanResource($plan);
    }

    /** Recompute arrival projections and report predicted breaches. */
    public function projectEta(string $tripId, string $planId): JsonResponse
    {
        $plan = $this->findPlan($tripId, $planId);
        $breaches = $this->eta->project($plan);

        return response()->json([
            'data' => [
                'plan_id' => $plan->uuid,
                'predicted_breaches' => $breaches,
                'stops' => $plan->refresh()->load('stopRefs.etaProjections')->stopRefs
                    ->map(static fn ($ref) => [
                        'stop_id' => $ref->stop_id,
                        'sequence' => $ref->sequence,
                        'is_frozen' => $ref->is_frozen,
                        'eta' => $ref->currentEta()?->projected_arrival_at?->toIso8601String(),
                        'refinement_level' => $ref->currentEta()?->refinement_level,
                        'breach_predicted' => (bool) $ref->currentEta()?->breach_predicted,
                        'minutes_late' => $ref->currentEta()?->minutes_late,
                    ])->values(),
            ],
        ]);
    }

    /** The immutable audit — snapshot, strategy, outcome. The replay harness. */
    public function run(string $id): JsonResponse
    {
        $run = OptimizationRun::where('uuid', $id)->firstOrFail();

        return response()->json([
            'data' => [
                'id' => $run->uuid,
                'strategy' => $run->strategy,
                'strategy_version' => $run->strategy_version,
                'succeeded' => $run->succeeded,
                'failure_reason' => $run->failure_reason,
                'stop_count' => $run->stop_count,
                'duration_ms' => $run->duration_ms,
                'violations' => $run->violations(),
                'is_replayable' => $run->isReplayable(),
                'request_snapshot' => $run->request_snapshot,
                'proposal_summary' => $run->proposal_summary,
                'created_at' => $run->created_at?->toIso8601String(),
            ],
        ]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function trip(string $id): Trip
    {
        return Trip::where('uuid', $id)->firstOrFail();
    }

    private function findPlan(string $tripId, string $planId): RoutePlan
    {
        return RoutePlan::query()
            ->where('uuid', $planId)
            ->whereHas('trip', fn ($q) => $q->where('uuid', $tripId))
            ->firstOrFail();
    }

    private function unprocessable(RoutingException $e): JsonResponse
    {
        return response()->json(['message' => $e->getMessage()], 422);
    }
}
