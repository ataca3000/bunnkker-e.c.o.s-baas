<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Logistics\Routing\Domain\Events\EtaBreachPredicted;
use Modules\Logistics\Routing\Domain\Events\EtaRevised;
use Modules\Logistics\Routing\Domain\Models\EtaProjection;
use Modules\Logistics\Routing\Domain\Models\RoutePlan;

/**
 * Projects arrival times, and predicts SLA breaches before they happen.
 *
 * ┌─ D3 — TELEMETRY DEFERRED ───────────────────────────────────────────────┐
 * │ Levels L0–L2 use nothing but V1 facts: the plan, the trip's departure,   │
 * │ and completed attempts. L3 (position-adjusted) needs Telemetry and is    │
 * │ Phase 8 — nothing here reads a telemetry_* table.                        │
 * │                                                                          │
 * │ ETA quality degrades without telemetry; ETA availability does not.       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * The SLA definition is LOG-005's — promised_at + sla_grace_minutes. Routing
 * FORECASTS against it rather than inventing a second definition, so there is
 * one SLA in the platform and Delivery still owns it.
 */
class EtaEngine
{
    /**
     * Compute and persist projections for every stop on a plan.
     *
     * Returns how many stops are predicted to breach.
     */
    public function project(RoutePlan $plan, ?Carbon $departAt = null): int
    {
        $plan->loadMissing(['stopRefs', 'legs', 'trip']);

        $level = EtaProjection::LEVEL_PLANNED;
        $cursor = $departAt;

        // L1: a dispatched trip has a real departure time.
        if ($cursor === null && $plan->trip?->departure_at !== null) {
            $cursor = Carbon::parse($plan->trip->departure_at);
            $level = EtaProjection::LEVEL_DEPARTURE_ADJUSTED;
        }

        $cursor ??= Carbon::now();

        $legsByTarget = $plan->legs->keyBy('to_stop_ref_id');
        $promises = $this->promisesForPlan($plan);

        $breaches = 0;

        foreach ($plan->stopRefs as $ref) {
            $leg = $legsByTarget->get($ref->id);
            $travel = (int) ($leg?->duration_minutes ?? 0);

            $cursor = $cursor->copy()->addMinutes($travel);
            $arrival = $cursor->copy();

            $promise = $promises[$ref->stop_id] ?? null;
            $minutesLate = null;
            $breachPredicted = false;

            if ($promise !== null) {
                // LOG-005's definition, unchanged: promised_at + grace.
                $deadline = Carbon::parse($promise['promised_at'])
                    ->addMinutes((int) ($promise['sla_grace_minutes'] ?? 0));

                if ($arrival->gt($deadline)) {
                    $breachPredicted = true;
                    $minutesLate = (int) $deadline->diffInMinutes($arrival, false);
                    $breaches++;
                }
            }

            EtaProjection::updateOrCreate(
                ['stop_ref_id' => $ref->id, 'refinement_level' => $level],
                [
                    'projected_arrival_at' => $arrival,
                    'service_minutes' => 0,
                    'breach_predicted' => $breachPredicted,
                    'minutes_late' => $minutesLate,
                ],
            );

            // Service time before moving on.
            $cursor = $cursor->copy()->addMinutes(8);
        }

        EtaRevised::dispatch($plan);

        if ($breaches > 0) {
            // The highest-value event in V2: converts Delivery's
            // after-the-fact breach into a before-the-fact warning, without
            // changing Delivery at all.
            EtaBreachPredicted::dispatch($plan);
        }

        return $breaches;
    }

    /**
     * Promised times for the stops on a plan, read from Delivery.
     *
     * A READ of delivery_* — Routing writes nothing there (Directive 7).
     * Returns empty when Delivery is not installed, and every caller tolerates
     * that.
     *
     * @return array<int, array<string, mixed>>  Keyed by stop id
     */
    private function promisesForPlan(RoutePlan $plan): array
    {
        if (! Schema::hasTable('delivery_deliveries')) {
            return [];
        }

        $stopIds = $plan->stopRefs->pluck('stop_id')->all();

        if ($stopIds === []) {
            return [];
        }

        return DB::table('delivery_deliveries')
            ->whereIn('current_stop_id', $stopIds)
            ->whereNotNull('promised_at')
            ->get(['current_stop_id', 'promised_at', 'sla_grace_minutes'])
            ->mapWithKeys(static fn ($row) => [
                (int) $row->current_stop_id => [
                    'promised_at' => $row->promised_at,
                    'sla_grace_minutes' => $row->sla_grace_minutes,
                ],
            ])
            ->all();
    }
}
