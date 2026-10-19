<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Services;

use Modules\Logistics\Dispatch\Domain\Models\DispatchPolicy;
use Modules\Logistics\Distribution\Domain\Models\Trip;

/**
 * Which vehicle best fits a trip, and why.
 *
 * A PURE function over a snapshot: no repository, no clock, no writes. That is
 * what makes a proposal reproducible — the same pool and trip always score the
 * same way, so a dispatcher's "why this vehicle?" has an answer weeks later.
 *
 * Weights come from DispatchPolicy (configuration), never from a constant here.
 */
class AssignmentScoringService
{
    /** Fallback weights when no policy is attached to the board. */
    private const DEFAULT_WEIGHTS = [
        'capacity_fit' => 40,
        'fitness' => 30,
        'zone_affinity' => 20,
        'utilisation' => 10,
    ];

    /**
     * @param  list<array<string, mixed>>  $vehicles
     * @return array{vehicle: array<string, mixed>|null, score: int, breakdown: array<string, mixed>}
     */
    public function bestFor(Trip $trip, array $vehicles, ?DispatchPolicy $policy = null): array
    {
        if ($vehicles === []) {
            return ['vehicle' => null, 'score' => 0, 'breakdown' => []];
        }

        $weights = $policy?->weights() ?? self::DEFAULT_WEIGHTS;
        $totalWeight = max(1, array_sum($weights));

        $best = null;
        $bestScore = -1;
        $bestBreakdown = [];

        foreach ($vehicles as $vehicle) {
            $factors = $this->factorsFor($trip, $vehicle);

            $earned = 0.0;
            foreach ($weights as $name => $weight) {
                $earned += $weight * ($factors[$name] ?? 0.0);
            }

            $score = (int) round(($earned / $totalWeight) * 100);

            if ($score > $bestScore) {
                $bestScore = $score;
                $best = $vehicle;
                $bestBreakdown = [
                    'weights' => $weights,
                    'factors' => $factors,
                ];
            }
        }

        return ['vehicle' => $best, 'score' => max(0, $bestScore), 'breakdown' => $bestBreakdown];
    }

    /**
     * Each factor scores 0.0–1.0, where 1.0 is a perfect fit.
     *
     * @param  array<string, mixed>  $vehicle
     * @return array<string, float>
     */
    private function factorsFor(Trip $trip, array $vehicle): array
    {
        return [
            'capacity_fit' => $this->capacityFit($trip, $vehicle),
            'fitness' => $this->fitnessScore($vehicle),
            'zone_affinity' => $this->zoneAffinity($trip, $vehicle),
            'utilisation' => $this->utilisationScore($vehicle),
        ];
    }

    /**
     * Rewards the SMALLEST vehicle that still fits.
     *
     * Sending a 60-order van on a 5-stop route is a real cost, so an oversized
     * vehicle scores lower than a snug one rather than being treated as equally
     * good. A vehicle that cannot fit scores zero and will also carry a hard
     * capacity blocker.
     *
     * @param  array<string, mixed>  $vehicle
     */
    private function capacityFit(Trip $trip, array $vehicle): float
    {
        $required = (int) ($trip->capacity ?? 0);
        $available = (int) ($vehicle['capacity_orders'] ?? 0);

        if ($available <= 0) {
            return 0.5;    // Capacity unknown — neither rewarded nor punished.
        }

        if ($required <= 0) {
            return 0.5;
        }

        if ($available < $required) {
            return 0.0;
        }

        return round(min(1.0, $required / $available), 4);
    }

    /** @param array<string, mixed> $vehicle */
    private function fitnessScore(array $vehicle): float
    {
        return match ($vehicle['fitness']['level'] ?? null) {
            'fit' => 1.0,
            'fit_with_warnings' => 0.6,
            default => 0.0,
        };
    }

    /**
     * Placeholder for zone affinity.
     *
     * Real affinity needs Routing's plan and the vehicle's recent history,
     * which arrive with Phase 3+. Returning a neutral 0.5 keeps the weight
     * wired and the breakdown honest rather than inventing a signal that does
     * not exist yet.
     *
     * @param  array<string, mixed>  $vehicle
     */
    private function zoneAffinity(Trip $trip, array $vehicle): float
    {
        return 0.5;
    }

    /**
     * Prefers an idle vehicle over one already in delivery.
     *
     * @param  array<string, mixed>  $vehicle
     */
    private function utilisationScore(array $vehicle): float
    {
        return match ($vehicle['v1_status'] ?? null) {
            'available' => 1.0,
            'assigned' => 0.4,
            'in_delivery' => 0.1,
            default => 0.0,
        };
    }
}
