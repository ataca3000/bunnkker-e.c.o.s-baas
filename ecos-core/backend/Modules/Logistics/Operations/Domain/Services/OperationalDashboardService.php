<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Logistics\Dispatch\Domain\Enums\AllocationStatus;
use Modules\Logistics\Dispatch\Domain\Models\ResourceAllocation;
use Modules\Logistics\Dispatch\Domain\Services\DispatchMonitoringService;
use Modules\Logistics\Dispatch\Domain\Services\ResourcePoolService;

/**
 * The five operational dashboards.
 *
 * ┌─ ASSEMBLY, NOT CALCULATION ─────────────────────────────────────────────┐
 * │ Every readiness verdict comes from Dispatch's ResourcePoolService (which  │
 * │ consumes Fleet and Drivers), every capacity figure from                   │
 * │ CapacityMonitoringService (Network's ledger), every dispatch metric from  │
 * │ Phase 3's DispatchMonitoringService. This class computes no business      │
 * │ fact of its own — it counts and pairs numbers the owning modules already  │
 * │ produced.                                                                 │
 * │                                                                          │
 * │ "In use now" is read from Dispatch's ResourceAllocation rows — the        │
 * │ resources Dispatch is currently holding. Utilisation is a SNAPSHOT        │
 * │ (in use ÷ available right now), never a projection: this is an            │
 * │ operational dashboard, and it does not predict.                           │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class OperationalDashboardService
{
    public function __construct(
        private readonly ResourcePoolService $dispatchPool,
        private readonly DispatchMonitoringService $dispatchMonitoring,
        private readonly CapacityMonitoringService $capacity,
        private readonly PoolHealthService $poolHealth,
        private readonly OperationalHealthService $health,
    ) {}

    /**
     * Fleet utilisation — how much of the assignable fleet is working right now,
     * and which vehicles are idle.
     *
     * @return array<string, mixed>
     */
    public function fleetUtilisation(?string $companyId = null): array
    {
        $pool = $this->dispatchPool->build($companyId);
        $vehicles = $pool['vehicles'];

        $assignable = $pool['assignable_vehicle_count'];
        $unfit = count(array_filter(
            $vehicles,
            static fn (array $v) => ($v['fitness']['is_assignable'] ?? true) === false,
        ));

        $inUse = $this->vehiclesInUse($companyId);
        $inUseAssignable = count(array_intersect(
            $inUse,
            array_map(static fn (array $v) => (int) $v['vehicle_id'], array_filter(
                $vehicles,
                static fn (array $v) => $v['is_assignable'] === true,
            )),
        ));

        return [
            'total_vehicles' => count($vehicles),
            'assignable' => $assignable,
            'unfit' => $unfit,
            'in_use_now' => $inUseAssignable,
            'idle_assignable' => max(0, $assignable - $inUseAssignable),
            // Snapshot, not a forecast. Null when nothing is assignable.
            'utilisation_now' => $assignable > 0 ? round($inUseAssignable / $assignable, 4) : null,
            // The idle vehicles, named — BO-1: an idle vehicle nobody noticed is
            // pure loss, and it is invisible in V1.
            'idle_vehicles' => array_values(array_filter(
                $vehicles,
                fn (array $v) => $v['is_assignable'] === true && ! in_array((int) $v['vehicle_id'], $inUse, true),
            )),
        ];
    }

    /**
     * Driver utilisation — the same shape for the crewing side.
     *
     * @return array<string, mixed>
     */
    public function driverUtilisation(?string $companyId = null): array
    {
        $pool = $this->dispatchPool->build($companyId);
        $drivers = $pool['drivers'];
        $available = $pool['available_driver_count'];

        $inUse = $this->driversInUse($companyId);
        $availableIds = array_map(
            static fn (array $d) => (int) $d['driver_id'],
            array_filter($drivers, static fn (array $d) => $d['can_start_deliveries'] === true),
        );
        $inUseAvailable = count(array_intersect($inUse, $availableIds));

        return [
            'total_drivers' => count($drivers),
            'available' => $available,
            'unavailable' => count($drivers) - $available,
            'in_use_now' => $inUseAvailable,
            'idle_available' => max(0, $available - $inUseAvailable),
            'utilisation_now' => $available > 0 ? round($inUseAvailable / $available, 4) : null,
            'idle_drivers' => array_values(array_filter(
                $drivers,
                fn (array $d) => $d['can_start_deliveries'] === true && ! in_array((int) $d['driver_id'], $inUse, true),
            )),
        ];
    }

    /**
     * Capacity utilisation — Network's ledger, reported not recomputed.
     *
     * @return array<string, mixed>
     */
    public function capacityUtilisation(?string $companyId = null, ?Carbon $date = null): array
    {
        return [
            'slots' => $this->capacity->overview($companyId, $date),
            'reservations' => $this->capacity->reservationStatistics($companyId),
        ];
    }

    /**
     * Dispatch performance — Phase 3's own figures, unchanged.
     *
     * @return array<string, mixed>
     */
    public function dispatchPerformance(?string $companyId = null, ?Carbon $from = null, ?Carbon $to = null): array
    {
        return [
            'kpis' => $this->dispatchMonitoring->kpis($companyId, $from, $to),
            'queue' => $this->dispatchMonitoring->queueStatistics($companyId),
            'assignment' => $this->dispatchMonitoring->assignmentHealth($companyId),
        ];
    }

    /**
     * The operational KPI roll-up — the one screen a manager opens.
     *
     * @return array<string, mixed>
     */
    public function operationalKpis(?string $companyId = null, ?Carbon $date = null): array
    {
        $overview = $this->health->overview($companyId, $date);
        $pools = $this->poolHealth->overview($companyId);
        $dispatch = $this->dispatchMonitoring->kpis($companyId);

        return [
            'generated_at' => Carbon::now()->toIso8601String(),
            'headline' => $overview['headline'],
            'is_quiet' => $overview['is_quiet'],
            'pools' => [
                'total' => $pools['pool_count'],
                'unhealthy' => $pools['unhealthy_count'],
                'available_vehicles' => $pools['total_available_vehicles'],
                'available_drivers' => $pools['total_available_drivers'],
                'fieldable' => min(
                    $pools['total_available_vehicles'],
                    $pools['total_available_drivers'],
                ),
            ],
            'dispatch' => [
                'sessions_active' => $dispatch['sessions_active'],
                'allocations_confirmed' => $dispatch['allocations_confirmed'],
                'confirmation_rate' => $dispatch['confirmation_rate'],
                'automatic_share' => $dispatch['automatic_share'],
            ],
        ];
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /**
     * Vehicle ids Dispatch is currently holding a resource for.
     *
     * @return list<int>
     */
    private function vehiclesInUse(?string $companyId): array
    {
        return $this->heldAllocations($companyId)
            ->pluck('vehicle_id')
            ->filter()
            ->map(static fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
    }

    /** @return list<int> */
    private function driversInUse(?string $companyId): array
    {
        return $this->heldAllocations($companyId)
            ->pluck('driver_id')
            ->filter()
            ->map(static fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
    }

    private function heldAllocations(?string $companyId): \Illuminate\Support\Collection
    {
        return ResourceAllocation::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->whereIn('status', [
                AllocationStatus::Reserved->value,
                AllocationStatus::Confirmed->value,
            ])
            ->get(['vehicle_id', 'driver_id']);
    }
}
