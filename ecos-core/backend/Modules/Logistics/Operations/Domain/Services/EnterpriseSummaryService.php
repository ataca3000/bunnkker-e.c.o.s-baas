<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Logistics\Dispatch\Domain\Services\DispatchMonitoringService;
use Modules\Logistics\Operations\Domain\Events\ExecutiveSummaryGenerated;

/**
 * The enterprise summaries — the plain-language digest a manager reads first.
 *
 * ┌─ DIGEST, NOT DATA SOURCE ───────────────────────────────────────────────┐
 * │ Every figure is lifted from an existing monitoring or dashboard service. │
 * │ This class chooses WHICH numbers matter for a one-glance summary and      │
 * │ arranges them; it produces none of its own. Reuse before invention, all  │
 * │ the way down.                                                            │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class EnterpriseSummaryService
{
    public function __construct(
        private readonly OperationalDashboardService $dashboards,
        private readonly OperationalHealthService $health,
        private readonly CapacityMonitoringService $capacity,
        private readonly DispatchMonitoringService $dispatch,
        private readonly ExceptionQueryService $exceptions,
        private readonly ReadinessValidationService $readiness,
    ) {}

    /**
     * The Executive Logistics Summary — health score, readiness and the
     * headline exception picture, together.
     *
     * @return array<string, mixed>
     */
    public function executive(?string $companyId = null): array
    {
        $overview = $this->health->overview($companyId);
        $score = $this->readiness->healthScore($companyId);

        $summary = [
            'generated_at' => Carbon::now()->toIso8601String(),
            'health_score' => $score['score'],
            'grade' => $score['grade'],
            'overall_status' => $score['overall_status'],
            'is_quiet' => $overview['is_quiet'],
            'headline' => $overview['headline'],
        ];

        // Notification only.
        ExecutiveSummaryGenerated::dispatch(
            $summary['health_score'],
            $summary['grade'],
            $summary['overall_status'],
            $companyId,
            $summary['generated_at'],
        );

        return $summary;
    }

    /**
     * Today's Operations Summary — what has moved today.
     *
     * @return array<string, mixed>
     */
    public function today(?string $companyId = null): array
    {
        $kpis = $this->dispatch->kpis($companyId);
        $queue = $this->dispatch->queueStatistics($companyId);

        return [
            'date' => Carbon::today()->toDateString(),
            'sessions_active' => $kpis['sessions_active'],
            'allocations_confirmed' => $kpis['allocations_confirmed'],
            'allocations_attempted' => $kpis['allocations_attempted'],
            'confirmation_rate' => $kpis['confirmation_rate'],
            'queue_depth' => $queue['depth'],
            'queue_needs_action' => $queue['needs_action'],
        ];
    }

    /**
     * Current Capacity Summary — Network's ledger at a glance.
     *
     * @return array<string, mixed>
     */
    public function capacity(?string $companyId = null): array
    {
        $overview = $this->capacity->overview($companyId);
        $reservations = $this->capacity->reservationStatistics($companyId);

        return [
            'date' => $overview['date'],
            'slots' => $overview['slot_count'],
            'avg_utilisation' => $overview['avg_utilisation'],
            'near_capacity' => $overview['at_warn_threshold'],
            'exhausted' => $overview['exhausted'],
            'currently_holding' => $reservations['currently_holding'],
            'refused' => $reservations['refused'],
            'refusal_rate' => $reservations['refusal_rate'],
        ];
    }

    /**
     * Dispatch Summary — Phase 3's KPIs, condensed.
     *
     * @return array<string, mixed>
     */
    public function dispatch(?string $companyId = null): array
    {
        $kpis = $this->dispatch->kpis($companyId);

        return [
            'sessions_active' => $kpis['sessions_active'],
            'sessions_abandoned' => $kpis['sessions_abandoned'],
            'allocations_confirmed' => $kpis['allocations_confirmed'],
            'allocations_failed' => $kpis['allocations_failed'],
            'confirmation_rate' => $kpis['confirmation_rate'],
            'automatic_share' => $kpis['automatic_share'],
            'avg_session_minutes' => $kpis['avg_session_minutes'],
        ];
    }

    /**
     * Fleet Summary — vehicles and drivers, from the Phase 5 dashboards.
     *
     * @return array<string, mixed>
     */
    public function fleet(?string $companyId = null): array
    {
        $fleet = $this->dashboards->fleetUtilisation($companyId);
        $drivers = $this->dashboards->driverUtilisation($companyId);

        return [
            'vehicles' => [
                'total' => $fleet['total_vehicles'],
                'assignable' => $fleet['assignable'],
                'unfit' => $fleet['unfit'],
                'in_use_now' => $fleet['in_use_now'],
                'idle_assignable' => $fleet['idle_assignable'],
                'utilisation_now' => $fleet['utilisation_now'],
            ],
            'drivers' => [
                'total' => $drivers['total_drivers'],
                'available' => $drivers['available'],
                'in_use_now' => $drivers['in_use_now'],
                'idle_available' => $drivers['idle_available'],
                'utilisation_now' => $drivers['utilisation_now'],
            ],
            // The pairing that actually limits the day.
            'fieldable_units' => min($fleet['in_use_now'] + $fleet['idle_assignable'], $drivers['in_use_now'] + $drivers['idle_available']),
        ];
    }

    /**
     * Exception Summary — the registry, broken down by who owns the problem.
     *
     * @return array<string, mixed>
     */
    public function exceptions(?string $companyId = null): array
    {
        $summary = $this->exceptions->summary($companyId);

        return [
            'outstanding' => $summary['outstanding'],
            'needs_attention' => $summary['needs_attention'],
            'critical' => $summary['critical'],
            'escalated' => $summary['escalated'],
            'recurring' => $summary['recurring'],
            'overdue_for_escalation' => $summary['overdue_for_escalation'],
            'by_source' => $summary['by_source'],
            'by_category' => $summary['by_category'],
        ];
    }
}
