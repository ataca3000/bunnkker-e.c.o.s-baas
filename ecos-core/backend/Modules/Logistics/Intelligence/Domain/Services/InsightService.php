<?php

declare(strict_types=1);

namespace Modules\Logistics\Intelligence\Domain\Services;

use Modules\Logistics\Dispatch\Domain\Services\DispatchMonitoringService;
use Modules\Logistics\Operations\Domain\Services\CapacityMonitoringService;
use Modules\Logistics\Operations\Domain\Services\ExceptionQueryService;
use Modules\Logistics\Operations\Domain\Services\OperationalDashboardService;

/**
 * The recommendation layer's human-facing surface — smart suggestions,
 * bottleneck detection, capacity warnings and operational insights.
 *
 * ┌─ INSIGHT, NOT ORACLE ───────────────────────────────────────────────────┐
 * │ Suggestions are the top of the ranked recommendations; bottleneck        │
 * │ detection is a deterministic "what is the binding constraint right now";  │
 * │ warnings and insights are read straight off the owning modules' figures. │
 * │ Nothing here computes readiness or capacity — it names what the numbers  │
 * │ already say.                                                             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Read-model only.
 */
class InsightService
{
    public function __construct(
        private readonly DecisionEngine $decisions,
        private readonly OperationalDashboardService $dashboards,
        private readonly CapacityMonitoringService $capacity,
        private readonly DispatchMonitoringService $dispatch,
        private readonly ExceptionQueryService $exceptions,
    ) {}

    /**
     * Smart suggestions — the highest-priority actions, phrased for a human.
     *
     * @return list<array<string, mixed>>
     */
    public function smartSuggestions(?string $companyId = null, int $limit = 5): array
    {
        $ranked = $this->decisions->recommendations($companyId);

        return array_slice(array_map(static fn (array $r) => [
            'title' => $r['title'],
            'suggestion' => $r['action'],
            'severity' => $r['severity'],
            'priority' => $r['priority'],
            'why' => $r['rationale'],
            'owning_module' => $r['source_module'],
        ], $ranked), 0, max(1, $limit));
    }

    /**
     * Bottleneck detection — the single binding constraint on throughput right
     * now, plus the runners-up.
     *
     * The whole operation is limited by whichever resource runs out first, so
     * this ranks the candidate constraints by how tight each is.
     *
     * @return array<string, mixed>
     */
    public function bottlenecks(?string $companyId = null): array
    {
        $fleet = $this->dashboards->fleetUtilisation($companyId);
        $drivers = $this->dashboards->driverUtilisation($companyId);
        $capacity = $this->capacity->overview($companyId);
        $queue = $this->dispatch->queueStatistics($companyId);
        $health = $this->dispatch->assignmentHealth($companyId);

        $candidates = [];

        // A binding constraint is one that is at or near zero headroom.
        if ($fleet['total_vehicles'] > 0 && $fleet['assignable'] === 0) {
            $candidates[] = $this->bottleneck('fleet', 'No assignable vehicle', 100, 'Clear fitness blockers in Fleet.');
        }
        if ($drivers['total_drivers'] > 0 && $drivers['available'] === 0) {
            $candidates[] = $this->bottleneck('drivers', 'No available driver', 100, 'Bring a driver on-shift.');
        }
        if ($capacity['slot_count'] > 0 && $capacity['exhausted'] >= $capacity['slot_count']) {
            $candidates[] = $this->bottleneck('capacity', 'All capacity slots exhausted', 95, 'Add capacity in Network.');
        }
        if ($health['blocking_conflicts'] > 0) {
            $candidates[] = $this->bottleneck('dispatch', "{$health['blocking_conflicts']} blocking conflict(s)", 90, 'Resolve conflicts in Dispatch.');
        }
        if ($queue['stuck'] > 0) {
            $candidates[] = $this->bottleneck('dispatch', "{$queue['stuck']} stuck queue item(s)", 70, 'Work the stuck items.');
        }

        // The tighter side of the vehicle/driver pairing, when neither is at zero.
        if ($candidates === [] && $fleet['idle_assignable'] >= 0 && $drivers['idle_available'] >= 0) {
            if ($drivers['idle_available'] < $fleet['idle_assignable']) {
                $candidates[] = $this->bottleneck('drivers', 'Drivers are the tighter side', 40, 'Add drivers to field more trips.');
            } elseif ($fleet['idle_assignable'] < $drivers['idle_available']) {
                $candidates[] = $this->bottleneck('fleet', 'Vehicles are the tighter side', 40, 'Free more assignable vehicles.');
            }
        }

        usort($candidates, static fn (array $a, array $b) => $b['tightness'] <=> $a['tightness']);

        return [
            'primary' => $candidates[0] ?? null,
            'candidates' => $candidates,
            'is_constrained' => $candidates !== [] && ($candidates[0]['tightness'] ?? 0) >= 90,
        ];
    }

    /**
     * Capacity warnings — the near-and-over-limit signals, with the reasons.
     *
     * @return array<string, mixed>
     */
    public function capacityWarnings(?string $companyId = null): array
    {
        $overview = $this->capacity->overview($companyId);
        $stats = $this->capacity->reservationStatistics($companyId);
        $refusals = $this->capacity->refusalReasons($companyId);

        $warnings = [];

        if ($overview['exhausted'] > 0) {
            $warnings[] = [
                'level' => 'critical',
                'message' => "{$overview['exhausted']} capacity slot(s) exhausted.",
            ];
        }
        if ($overview['at_warn_threshold'] > 0) {
            $warnings[] = [
                'level' => 'warning',
                'message' => "{$overview['at_warn_threshold']} slot(s) near capacity.",
            ];
        }
        if ($stats['refusal_rate'] !== null && $stats['refusal_rate'] >= 0.2) {
            $pct = (int) round($stats['refusal_rate'] * 100);
            $warnings[] = [
                'level' => 'warning',
                'message' => "{$pct}% of reservations were refused.",
            ];
        }

        return [
            'warnings' => $warnings,
            'has_warnings' => $warnings !== [],
            'top_refusal_reasons' => $refusals,
        ];
    }

    /**
     * Operational insights — plain-language observations about the state of the
     * operation, each backed by a figure.
     *
     * @return list<array<string, mixed>>
     */
    public function operationalInsights(?string $companyId = null): array
    {
        $fleet = $this->dashboards->fleetUtilisation($companyId);
        $drivers = $this->dashboards->driverUtilisation($companyId);
        $kpis = $this->dashboards->operationalKpis($companyId);
        $exceptions = $this->exceptions->summary($companyId);

        $insights = [];

        if ($fleet['utilisation_now'] !== null) {
            $pct = (int) round($fleet['utilisation_now'] * 100);
            $insights[] = [
                'topic' => 'fleet_utilisation',
                'insight' => "Fleet is {$pct}% utilised right now.",
                'signal' => $pct >= 85 ? 'high' : ($pct <= 30 ? 'low' : 'normal'),
            ];
        }

        $insights[] = [
            'topic' => 'fieldable',
            'insight' => "{$kpis['pools']['fieldable']} trip(s) can be fielded right now, limited by "
                .($fleet['idle_assignable'] <= $drivers['idle_available'] ? 'vehicles' : 'drivers').'.',
            'signal' => $kpis['pools']['fieldable'] === 0 ? 'critical' : 'normal',
        ];

        if ($exceptions['recurring'] > 0) {
            $insights[] = [
                'topic' => 'recurring_exceptions',
                'insight' => "{$exceptions['recurring']} exception(s) are recurring — a systemic issue, not a one-off.",
                'signal' => 'warning',
            ];
        }

        if ($exceptions['overdue_for_escalation'] > 0) {
            $insights[] = [
                'topic' => 'overdue_escalations',
                'insight' => "{$exceptions['overdue_for_escalation']} exception(s) have waited past their escalation threshold.",
                'signal' => 'warning',
            ];
        }

        return $insights;
    }

    /**
     * @return array<string, mixed>
     */
    private function bottleneck(string $module, string $reason, int $tightness, string $action): array
    {
        return [
            'module' => $module,
            'reason' => $reason,
            'tightness' => $tightness,
            'action' => $action,
        ];
    }
}
