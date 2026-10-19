<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Logistics\Dispatch\Domain\Services\DispatchMonitoringService;

/**
 * The one screen an operations manager opens in the morning.
 *
 * ┌─ EVERY NUMBER IS SOMEBODY ELSE'S ───────────────────────────────────────┐
 * │ Dispatch health comes from Phase 3's DispatchMonitoringService.          │
 * │ Capacity comes from Network's ledger via CapacityMonitoringService.      │
 * │ Resource health comes from Fleet and Drivers via PoolHealthService.      │
 * │                                                                          │
 * │ This class computes nothing of its own except the roll-up. If a figure   │
 * │ here ever disagreed with the owning module's own screen, one of them     │
 * │ would be lying, and an operator would have to guess which.               │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Operational only. Nothing forecasts, scores or predicts — the target is that
 * an operator's screen is empty when the operation is healthy (§7.1).
 */
class OperationalHealthService
{
    public function __construct(
        private readonly PoolHealthService $poolHealth,
        private readonly CapacityMonitoringService $capacity,
        private readonly DispatchMonitoringService $dispatch,
        private readonly OperationalAlertService $alerts,
        private readonly ExceptionQueryService $exceptions,
    ) {}

    /**
     * Resource dashboard — can we field anything today?
     *
     * @return array<string, mixed>
     */
    public function resourceHealth(?string $companyId = null): array
    {
        return $this->poolHealth->overview($companyId);
    }

    /**
     * Capacity dashboard — Network's ledger, reported not recomputed.
     *
     * @return array<string, mixed>
     */
    public function capacityHealth(?string $companyId = null, ?Carbon $date = null): array
    {
        return [
            'slots' => $this->capacity->overview($companyId, $date),
            'reservations' => $this->capacity->reservationStatistics($companyId),
            // Refusals only mean something in aggregate: one is an incident,
            // forty of the same is a capacity plan that needs changing.
            'refusal_reasons' => $this->capacity->refusalReasons($companyId),
        ];
    }

    /**
     * Dispatch dashboard — Phase 3's own numbers, unchanged.
     *
     * @return array<string, mixed>
     */
    public function dispatchHealth(?string $companyId = null): array
    {
        return [
            'kpis' => $this->dispatch->kpis($companyId),
            'queue' => $this->dispatch->queueStatistics($companyId),
            'assignment' => $this->dispatch->assignmentHealth($companyId),
            'exceptions' => $this->dispatch->exceptions($companyId),
        ];
    }

    /**
     * Utilisation — what is being used against what exists.
     *
     * The idle counts are where the money is: an assignable vehicle in no pool
     * is capacity nobody is planning with, and it is invisible in V1.
     *
     * @return array<string, mixed>
     */
    public function utilisation(?string $companyId = null, ?Carbon $date = null): array
    {
        $pools = $this->poolHealth->overview($companyId);
        $capacity = $this->capacity->overview($companyId, $date);

        $availableVehicles = $pools['total_available_vehicles'];
        $availableDrivers = $pools['total_available_drivers'];

        return [
            'date' => ($date ?? Carbon::today())->toDateString(),
            'pooled_available_vehicles' => $availableVehicles,
            'pooled_available_drivers' => $availableDrivers,
            // The pairing that actually limits a day: vehicles with no drivers
            // field nothing, and neither number alone shows it.
            'fieldable_units' => min($availableVehicles, $availableDrivers),
            'capacity_utilisation' => $capacity['avg_utilisation'],
            'slots_exhausted' => $capacity['exhausted'],
            'slots_near_capacity' => $capacity['at_warn_threshold'],
            'unhealthy_pools' => $pools['unhealthy_count'],
        ];
    }

    /**
     * The headline strip — six numbers, each one a reason to click through.
     *
     * @return array<string, mixed>
     */
    public function overview(?string $companyId = null, ?Carbon $date = null): array
    {
        $pools = $this->poolHealth->overview($companyId);
        $capacity = $this->capacity->overview($companyId, $date);
        $alerts = $this->alerts->summary($companyId);
        $queue = $this->exceptions->summary($companyId);

        return [
            'generated_at' => Carbon::now()->toIso8601String(),
            'headline' => [
                'critical_alerts' => $alerts['critical'],
                'open_exceptions' => $queue['needs_attention'],
                'unhealthy_pools' => $pools['unhealthy_count'],
                'exhausted_capacity_slots' => $capacity['exhausted'],
                'fieldable_units' => min(
                    $pools['total_available_vehicles'],
                    $pools['total_available_drivers'],
                ),
                'overdue_escalations' => $alerts['overdue'],
            ],
            'alerts' => $alerts,
            'exceptions' => $queue,
            // The stance from ADR-006 stated as data: a healthy operation shows
            // an operator nothing to do.
            'is_quiet' => $alerts['total'] === 0
                && $queue['needs_attention'] === 0
                && $pools['unhealthy_count'] === 0,
        ];
    }
}
