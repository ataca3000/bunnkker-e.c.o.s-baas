<?php

declare(strict_types=1);

namespace Modules\Logistics\Intelligence\Domain\Services;

use Modules\Logistics\Dispatch\Domain\Services\DispatchMonitoringService;
use Modules\Logistics\Operations\Domain\Services\CapacityMonitoringService;
use Modules\Logistics\Operations\Domain\Services\OperationalDashboardService;
use Modules\Logistics\Operations\Domain\Services\UnifiedResourcePoolService;

/**
 * Optimisation recommendations — where the operation is leaving value on the
 * table, and the concrete move that recovers it.
 *
 * ┌─ DETERMINISTIC HEURISTICS OVER EXISTING NUMBERS ────────────────────────┐
 * │ Every suggestion is arithmetic over figures the owning modules already   │
 * │ produced — idle counts, utilisation, refusal reasons, queue depth. There │
 * │ is no solver and no model here: the moves are transparent and a human    │
 * │ can check the reasoning. Actual routing stays with the Routing module's  │
 * │ deterministic strategies; this only flags WHEN to invoke it.             │
 * │                                                                          │
 * │ Read-model only. Nothing is stored or recomputed that a module already   │
 * │ owns.                                                                     │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class OptimizationService
{
    public function __construct(
        private readonly OperationalDashboardService $dashboards,
        private readonly CapacityMonitoringService $capacity,
        private readonly DispatchMonitoringService $dispatch,
        private readonly UnifiedResourcePoolService $pools,
    ) {}

    /**
     * Vehicle optimisation — idle assignable vehicles that could be working.
     *
     * @return array<string, mixed>
     */
    public function vehicleOptimisation(?string $companyId = null): array
    {
        $fleet = $this->dashboards->fleetUtilisation($companyId);
        $unassigned = $this->pools->unassigned($companyId);

        $suggestions = [];

        if ($fleet['idle_assignable'] > 0) {
            $suggestions[] = [
                'move' => 'assign_idle_vehicles',
                'detail' => "{$fleet['idle_assignable']} assignable vehicle(s) are idle and could be dispatched.",
                'owning_module' => 'dispatch',
            ];
        }

        if ($unassigned['idle_assignable_vehicles'] > 0) {
            $suggestions[] = [
                'move' => 'pool_unassigned_vehicles',
                'detail' => "{$unassigned['idle_assignable_vehicles']} assignable vehicle(s) belong to no pool — capacity nobody is planning with.",
                'owning_module' => 'operations',
            ];
        }

        return [
            'utilisation_now' => $fleet['utilisation_now'],
            'idle_assignable' => $fleet['idle_assignable'],
            'unpooled_assignable' => $unassigned['idle_assignable_vehicles'],
            'suggestions' => $suggestions,
            'idle_vehicles' => $fleet['idle_vehicles'],
        ];
    }

    /**
     * Capacity optimisation — where to add or rebalance headroom.
     *
     * @return array<string, mixed>
     */
    public function capacityOptimisation(?string $companyId = null): array
    {
        $overview = $this->capacity->overview($companyId);
        $stats = $this->capacity->reservationStatistics($companyId);
        $refusals = $this->capacity->refusalReasons($companyId);

        $suggestions = [];

        if ($overview['exhausted'] > 0) {
            $suggestions[] = [
                'move' => 'add_capacity',
                'detail' => "{$overview['exhausted']} slot(s) exhausted — add capacity in Network for the affected windows.",
                'owning_module' => 'network',
            ];
        }

        if ($stats['rebalanced'] === 0 && $overview['at_warn_threshold'] > 0) {
            $suggestions[] = [
                'move' => 'rebalance_reservations',
                'detail' => "{$overview['at_warn_threshold']} slot(s) near capacity — rebalance held reservations to emptier slots.",
                'owning_module' => 'operations',
            ];
        }

        return [
            'avg_utilisation' => $overview['avg_utilisation'],
            'exhausted' => $overview['exhausted'],
            'near_capacity' => $overview['at_warn_threshold'],
            // The refusal reasons are the evidence for WHERE to add capacity.
            'top_refusal_reasons' => $refusals,
            'suggestions' => $suggestions,
        ];
    }

    /**
     * Route recommendation — WHEN route optimisation is worth running. The
     * routing itself stays with the Routing module's deterministic strategies;
     * this only surfaces the trigger.
     *
     * @return array<string, mixed>
     */
    public function routeRecommendation(?string $companyId = null): array
    {
        $queue = $this->dispatch->queueStatistics($companyId);

        $shouldOptimise = $queue['depth'] > 0
            && ($queue['oldest_wait_minutes'] ?? 0) >= 30;

        return [
            'queue_depth' => $queue['depth'],
            'oldest_wait_minutes' => $queue['oldest_wait_minutes'],
            'should_run_optimisation' => $shouldOptimise,
            'suggestion' => $shouldOptimise
                ? [
                    'move' => 'run_route_optimisation',
                    'detail' => "{$queue['depth']} trip(s) queued with waits past 30 minutes — run the Routing module's optimisation.",
                    'owning_module' => 'routing',
                ]
                : null,
            // Named explicitly: this module does not compute routes.
            'note' => 'Routing remains deterministic and owned by the Routing module; this only signals when to invoke it.',
        ];
    }

    /**
     * Assignment recommendation — how many more trips could be crewed right now,
     * limited by the scarcer of vehicles and drivers.
     *
     * @return array<string, mixed>
     */
    public function assignmentRecommendation(?string $companyId = null): array
    {
        $fleet = $this->dashboards->fleetUtilisation($companyId);
        $drivers = $this->dashboards->driverUtilisation($companyId);

        // The pairing that actually limits the operation.
        $fieldableNow = min($fleet['idle_assignable'], $drivers['idle_available']);

        $constraint = match (true) {
            $fleet['idle_assignable'] < $drivers['idle_available'] => 'vehicles',
            $drivers['idle_available'] < $fleet['idle_assignable'] => 'drivers',
            default => 'balanced',
        };

        return [
            'idle_assignable_vehicles' => $fleet['idle_assignable'],
            'idle_available_drivers' => $drivers['idle_available'],
            // Deterministic: you can crew as many trips as the scarcer side allows.
            'additional_assignments_possible' => $fieldableNow,
            'binding_constraint' => $constraint,
            'suggestion' => $fieldableNow > 0
                ? [
                    'move' => 'assign_available_pairs',
                    'detail' => "{$fieldableNow} more trip(s) could be crewed now from idle vehicles and drivers.",
                    'owning_module' => 'dispatch',
                ]
                : null,
        ];
    }
}
