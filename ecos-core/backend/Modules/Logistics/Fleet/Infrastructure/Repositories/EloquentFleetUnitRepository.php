<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Infrastructure\Repositories;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Modules\Logistics\Fleet\Domain\Contracts\FleetUnitRepositoryInterface;
use Modules\Logistics\Fleet\Domain\Enums\DefectSeverity;
use Modules\Logistics\Fleet\Domain\Enums\FleetUnitLifecycle;
use Modules\Logistics\Fleet\Domain\Models\FleetUnit;
use Modules\Logistics\Fleet\Domain\Models\MaintenancePlan;

class EloquentFleetUnitRepository implements FleetUnitRepositoryInterface
{
    public function findByUuid(string $uuid): ?FleetUnit
    {
        return $this->withRelations()->where('uuid', $uuid)->first();
    }

    public function findByUuidOrFail(string $uuid): FleetUnit
    {
        return $this->withRelations()->where('uuid', $uuid)->firstOrFail();
    }

    public function findByVehicleId(int $vehicleId): ?FleetUnit
    {
        return FleetUnit::query()->where('vehicle_id', $vehicleId)->first();
    }

    public function paginate(array $filters = [], int $perPage = 20): LengthAwarePaginator
    {
        $query = FleetUnit::query()
            ->withCount([
                'defects as open_defect_count' => fn (Builder $q) => $q
                    ->whereNull('resolved_at')->whereNull('dismissed_by'),
                'workOrders as open_work_order_count' => fn (Builder $q) => $q
                    ->whereNotIn('status', ['completed', 'cancelled']),
            ])
            // The list leads with why a vehicle is unfit, so the facts that
            // produce a verdict travel with it rather than costing N+1 queries.
            ->with(['vehicle', 'group', 'maintenancePlans'])
            ->latest('id');

        $this->applyFilters($query, $filters);

        return $query->paginate($perPage);
    }

    public function create(array $attributes): FleetUnit
    {
        return FleetUnit::create($attributes);
    }

    public function update(FleetUnit $unit, array $attributes): FleetUnit
    {
        $unit->update($attributes);

        return $unit->refresh();
    }

    public function statistics(?string $companyId = null): array
    {
        $scoped = fn (Builder $q) => $q->when($companyId !== null, fn ($b) => $b->where('company_id', $companyId));

        $byState = FleetUnit::query()
            ->tap($scoped)
            ->selectRaw('lifecycle_state, COUNT(*) AS total')
            ->groupBy('lifecycle_state')
            ->pluck('total', 'lifecycle_state');

        $count = static fn (FleetUnitLifecycle $s): int => (int) ($byState[$s->value] ?? 0);

        $criticalDefects = \Modules\Logistics\Fleet\Domain\Models\Defect::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->where('severity', DefectSeverity::Critical->value)
            ->whereNull('resolved_at')
            ->whereNull('dismissed_by')
            ->count();

        $openWorkOrders = \Modules\Logistics\Fleet\Domain\Models\WorkOrder::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->count();

        return [
            'total' => (int) $byState->sum(),
            'draft' => $count(FleetUnitLifecycle::Draft),
            'commissioning' => $count(FleetUnitLifecycle::Commissioning),
            'active' => $count(FleetUnitLifecycle::Active),
            'suspended' => $count(FleetUnitLifecycle::Suspended),
            'decommissioning' => $count(FleetUnitLifecycle::Decommissioning),
            'retired' => $count(FleetUnitLifecycle::Retired),
            'open_critical_defects' => $criticalDefects,
            'open_work_orders' => $openWorkOrders,
            'overdue_maintenance' => count($this->unitsWithOverdueMaintenance($companyId)),
            'stale_odometer' => $this->staleOdometerCount($companyId),
        ];
    }

    public function unitsWithOverdueMaintenance(?string $companyId = null): array
    {
        $today = Carbon::today();

        $units = FleetUnit::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->where('lifecycle_state', '!=', FleetUnitLifecycle::Retired->value)
            ->with('maintenancePlans')
            ->get();

        return $units
            ->filter(function (FleetUnit $unit) use ($today): bool {
                $km = $unit->current_odometer_km !== null ? (float) $unit->current_odometer_km : null;

                return $unit->maintenancePlans
                    ->where('is_active', true)
                    ->contains(fn (MaintenancePlan $plan) => $plan->isOverdue($km, $today));
            })
            ->values()
            ->all();
    }

    /**
     * Vehicles that have gone quiet. Distance is the denominator of most cost
     * metrics, so a unit with no reading for two weeks silently distorts every
     * report that divides by it — this makes that visible.
     */
    public function staleOdometerCount(?string $companyId = null, int $thresholdDays = 14): int
    {
        return FleetUnit::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->where('lifecycle_state', FleetUnitLifecycle::Active->value)
            ->where(function (Builder $q) use ($thresholdDays) {
                $q->whereNull('odometer_updated_at')
                    ->orWhere('odometer_updated_at', '<', Carbon::now()->subDays($thresholdDays));
            })
            ->count();
    }

    private function withRelations(): Builder
    {
        return FleetUnit::query()->with([
            'vehicle',
            'group.fleet',
            'maintenancePlans.rules',
            'defects',
            'workOrders',
        ]);
    }

    /** @param array<string, mixed> $filters */
    private function applyFilters(Builder $query, array $filters): void
    {
        if (! empty($filters['company_id'])) {
            $query->where('company_id', $filters['company_id']);
        }

        if (! empty($filters['fleet_group_id'])) {
            $query->where('fleet_group_id', $filters['fleet_group_id']);
        }

        $state = $filters['lifecycle_state'] ?? null;
        if ($state !== null && in_array($state, FleetUnitLifecycle::values(), true)) {
            $query->where('lifecycle_state', $state);
        } elseif ($state !== 'all') {
            // Default view hides retired units — the fleet board is about what
            // can go out today.
            $query->where('lifecycle_state', '!=', FleetUnitLifecycle::Retired->value);
        }

        if (filter_var($filters['has_critical_defect'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            $query->whereHas('defects', fn (Builder $q) => $q
                ->where('severity', DefectSeverity::Critical->value)
                ->whereNull('resolved_at')
                ->whereNull('dismissed_by'));
        }

        if (filter_var($filters['has_open_work_order'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            $query->whereHas('workOrders', fn (Builder $q) => $q
                ->whereNotIn('status', ['completed', 'cancelled']));
        }

        if (! empty($filters['vehicle_id'])) {
            $query->where('vehicle_id', $filters['vehicle_id']);
        }
    }
}
