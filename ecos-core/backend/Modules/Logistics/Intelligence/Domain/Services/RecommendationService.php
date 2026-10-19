<?php

declare(strict_types=1);

namespace Modules\Logistics\Intelligence\Domain\Services;

use Modules\Logistics\Dispatch\Domain\Services\DispatchMonitoringService;
use Modules\Logistics\Intelligence\Domain\Enums\RecommendationSeverity;
use Modules\Logistics\Intelligence\Domain\ValueObjects\Recommendation;
use Modules\Logistics\Operations\Domain\Services\CapacityMonitoringService;
use Modules\Logistics\Operations\Domain\Services\CrossModuleValidationService;
use Modules\Logistics\Operations\Domain\Services\OperationalDashboardService;

/**
 * Turns the operational picture into actionable recommendations.
 *
 * ┌─ READS, INTERPRETS, SUGGESTS — NEVER RECOMPUTES ────────────────────────┐
 * │ Every figure comes from an existing service: Fleet/Drivers via the       │
 * │ operational dashboards, Network via CapacityMonitoringService, Dispatch  │
 * │ via DispatchMonitoringService, cross-module state via validation. This   │
 * │ service performs NO readiness or capacity calculation of its own — it    │
 * │ reads the numbers the owning modules already produced and phrases the    │
 * │ decision they imply.                                                     │
 * │                                                                          │
 * │ Read-model only: nothing is stored, nothing is cached, and the full set  │
 * │ is derived fresh on each call.                                           │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class RecommendationService
{
    /** Below this share of idle assignable vehicles, the fleet is underused. */
    private const FLEET_UNDERUSE = 0.4;

    public function __construct(
        private readonly OperationalDashboardService $dashboards,
        private readonly CapacityMonitoringService $capacity,
        private readonly DispatchMonitoringService $dispatch,
        private readonly CrossModuleValidationService $validation,
    ) {}

    /**
     * Every recommendation the current state implies, unranked.
     *
     * @return list<Recommendation>
     */
    public function generate(?string $companyId = null): array
    {
        return [
            ...$this->fleetRecommendations($companyId),
            ...$this->capacityRecommendations($companyId),
            ...$this->dispatchRecommendations($companyId),
        ];
    }

    // ── Fleet & crew ──────────────────────────────────────────────────────────

    /** @return list<Recommendation> */
    private function fleetRecommendations(?string $companyId): array
    {
        $fleet = $this->dashboards->fleetUtilisation($companyId);
        $drivers = $this->dashboards->driverUtilisation($companyId);

        $out = [];

        // Assignable vehicles sitting idle are capacity nobody is planning with.
        if ($fleet['idle_assignable'] > 0 && $fleet['assignable'] > 0
            && ($fleet['idle_assignable'] / $fleet['assignable']) >= self::FLEET_UNDERUSE) {
            $out[] = new Recommendation(
                type: 'fleet.underutilised',
                category: 'fleet',
                severity: RecommendationSeverity::Medium,
                title: 'Idle assignable vehicles',
                detail: "{$fleet['idle_assignable']} of {$fleet['assignable']} assignable vehicles are idle right now.",
                action: 'Assign idle vehicles through Dispatch, or scale down the shift.',
                sourceModule: 'fleet',
                rationale: ["Fleet reports {$fleet['idle_assignable']} idle assignable vehicles."],
                impact: 'Recovers unused fleet capacity.',
            );
        }

        // A vehicle with no driver fields nothing, and vice-versa — the scarcer
        // side is the real constraint.
        if ($fleet['assignable'] > 0 && $drivers['available'] === 0) {
            $out[] = new Recommendation(
                type: 'crew.no_drivers',
                category: 'drivers',
                severity: RecommendationSeverity::Critical,
                title: 'Vehicles available but no drivers',
                detail: "{$fleet['assignable']} vehicles are ready but no driver is available to crew them.",
                action: 'Bring a driver on-shift, or the fleet cannot move.',
                sourceModule: 'drivers',
                rationale: ['Drivers reports 0 available; Fleet reports assignable vehicles.'],
                impact: 'Unblocks the entire fleet.',
            );
        } elseif ($drivers['available'] > 0 && $fleet['assignable'] === 0 && $fleet['total_vehicles'] > 0) {
            $out[] = new Recommendation(
                type: 'crew.no_vehicles',
                category: 'fleet',
                severity: RecommendationSeverity::High,
                title: 'Drivers available but no assignable vehicle',
                detail: "{$drivers['available']} drivers are ready but Fleet reports no assignable vehicle.",
                action: 'Clear the fleet blockers — inspections or maintenance — in Fleet.',
                sourceModule: 'fleet',
                rationale: ['Fleet reports 0 assignable vehicles.'],
                impact: 'Lets available drivers be put to work.',
            );
        }

        // A large unfit share is a maintenance signal, not a dispatch one.
        if ($fleet['total_vehicles'] > 0 && ($fleet['unfit'] / $fleet['total_vehicles']) >= 0.5) {
            $out[] = new Recommendation(
                type: 'fleet.high_unfit',
                category: 'fleet',
                severity: RecommendationSeverity::High,
                title: 'Over half the fleet is unfit',
                detail: "{$fleet['unfit']} of {$fleet['total_vehicles']} vehicles are unfit.",
                action: 'Prioritise inspections and maintenance in Fleet.',
                sourceModule: 'fleet',
                rationale: ["Fleet reports {$fleet['unfit']} unfit of {$fleet['total_vehicles']}."],
                impact: 'Restores dispatchable capacity.',
            );
        }

        return $out;
    }

    // ── Capacity ──────────────────────────────────────────────────────────────

    /** @return list<Recommendation> */
    private function capacityRecommendations(?string $companyId): array
    {
        $overview = $this->capacity->overview($companyId);
        $stats = $this->capacity->reservationStatistics($companyId);

        $out = [];

        if ($overview['slot_count'] > 0 && $overview['exhausted'] >= $overview['slot_count']) {
            $out[] = new Recommendation(
                type: 'capacity.exhausted',
                category: 'capacity',
                severity: RecommendationSeverity::Critical,
                title: 'All capacity slots exhausted',
                detail: "Every one of {$overview['slot_count']} slots is exhausted; the network cannot take more.",
                action: 'Add capacity in Network, or defer non-urgent orders.',
                sourceModule: 'network',
                rationale: ["Network reports {$overview['exhausted']} of {$overview['slot_count']} slots exhausted."],
                impact: 'Prevents refused reservations.',
            );
        } elseif ($overview['at_warn_threshold'] > 0) {
            $out[] = new Recommendation(
                type: 'capacity.near_limit',
                category: 'capacity',
                severity: RecommendationSeverity::Medium,
                title: 'Capacity approaching its limit',
                detail: "{$overview['at_warn_threshold']} slot(s) are near capacity.",
                action: 'Rebalance reservations, or add headroom in Network.',
                sourceModule: 'network',
                rationale: ["Network reports {$overview['at_warn_threshold']} slot(s) at the warning threshold."],
                impact: 'Avoids exhaustion later in the window.',
            );
        }

        // A repeated refusal is a plan problem, not an incident.
        if ($stats['refusal_rate'] !== null && $stats['refusal_rate'] >= 0.2 && $stats['requested'] > 0) {
            $pct = (int) round($stats['refusal_rate'] * 100);
            $out[] = new Recommendation(
                type: 'capacity.high_refusal',
                category: 'capacity',
                severity: RecommendationSeverity::High,
                title: 'High reservation refusal rate',
                detail: "{$pct}% of reservation requests were refused.",
                action: 'Review the capacity plan in Network against demand.',
                sourceModule: 'network',
                rationale: ["Network refused {$stats['refused']} of {$stats['requested']} requests."],
                impact: 'Reduces failed reservations and rework.',
            );
        }

        return $out;
    }

    // ── Dispatch ──────────────────────────────────────────────────────────────

    /** @return list<Recommendation> */
    private function dispatchRecommendations(?string $companyId): array
    {
        $queue = $this->dispatch->queueStatistics($companyId);
        $health = $this->dispatch->assignmentHealth($companyId);
        $kpis = $this->dispatch->kpis($companyId);

        $out = [];

        if ($health['blocking_conflicts'] > 0) {
            $out[] = new Recommendation(
                type: 'dispatch.blocking_conflicts',
                category: 'dispatch',
                severity: RecommendationSeverity::Critical,
                title: 'Blocking conflicts are stopping releases',
                detail: "{$health['blocking_conflicts']} blocking conflict(s) are outstanding.",
                action: 'Resolve them in the Dispatch Command Center.',
                sourceModule: 'dispatch',
                rationale: ["Dispatch reports {$health['blocking_conflicts']} blocking conflict(s)."],
                impact: 'Unblocks stalled dispatch.',
            );
        }

        if ($queue['stuck'] > 0) {
            $out[] = new Recommendation(
                type: 'dispatch.stuck_queue',
                category: 'dispatch',
                severity: RecommendationSeverity::High,
                title: 'Queue items keep failing',
                detail: "{$queue['stuck']} item(s) have failed repeatedly and need a human.",
                action: 'Review the stuck items in the Execution Queue.',
                sourceModule: 'dispatch',
                rationale: ["Dispatch reports {$queue['stuck']} stuck queue item(s)."],
                impact: 'Clears trips that will never self-resolve.',
            );
        }

        // A low confirmation rate with real attempts is a policy signal.
        if ($kpis['confirmation_rate'] !== null && $kpis['confirmation_rate'] < 0.5
            && $kpis['allocations_attempted'] >= 5) {
            $pct = (int) round($kpis['confirmation_rate'] * 100);
            $out[] = new Recommendation(
                type: 'dispatch.low_confirmation',
                category: 'dispatch',
                severity: RecommendationSeverity::Medium,
                title: 'Low allocation confirmation rate',
                detail: "Only {$pct}% of {$kpis['allocations_attempted']} allocation attempts were confirmed.",
                action: 'Review why allocations are failing — fitness, capacity or conflicts.',
                sourceModule: 'dispatch',
                rationale: ["Dispatch reports a {$pct}% confirmation rate."],
                impact: 'Improves first-pass dispatch success.',
            );
        }

        return $out;
    }
}
