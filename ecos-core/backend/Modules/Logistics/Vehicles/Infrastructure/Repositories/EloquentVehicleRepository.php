<?php

declare(strict_types=1);

namespace Modules\Logistics\Vehicles\Infrastructure\Repositories;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Modules\Logistics\Vehicles\Domain\Contracts\VehicleRepositoryInterface;
use Modules\Logistics\Vehicles\Domain\Enums\VehicleDocumentType;
use Modules\Logistics\Vehicles\Domain\Enums\VehicleStatus;
use Modules\Logistics\Vehicles\Domain\Enums\VehicleType;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;

class EloquentVehicleRepository implements VehicleRepositoryInterface
{
    public function findById(int $id): ?Vehicle
    {
        return $this->withRelations()->find($id);
    }

    public function findByIdOrFail(int $id): Vehicle
    {
        return $this->withRelations()->findOrFail($id);
    }

    public function findByUuid(string $uuid): ?Vehicle
    {
        return $this->withRelations()->where('uuid', $uuid)->first();
    }

    public function paginate(array $filters = [], int $perPage = 20): LengthAwarePaginator
    {
        $query = Vehicle::query()
            ->withCount(['maintenanceRecords', 'documents'])
            ->with(['shippingCompany', 'documents', 'activeAssignment.driver'])
            ->orderBy('plate_number');

        $this->applyFilters($query, $filters);

        return $query->paginate($perPage);
    }

    public function create(array $attributes): Vehicle
    {
        return Vehicle::create($attributes);
    }

    public function update(Vehicle $vehicle, array $attributes): Vehicle
    {
        $vehicle->update($attributes);

        return $vehicle->refresh();
    }

    public function statistics(): array
    {
        $byStatus = Vehicle::query()
            ->selectRaw('status, COUNT(*) AS total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $count = static fn (VehicleStatus $s): int => (int) ($byStatus[$s->value] ?? 0);

        return [
            'total_vehicles' => (int) $byStatus->sum(),
            'available' => $count(VehicleStatus::Available),
            'assigned' => $count(VehicleStatus::Assigned),
            'in_delivery' => $count(VehicleStatus::InDelivery),
            'maintenance' => $count(VehicleStatus::Maintenance),
            'out_of_service' => $count(VehicleStatus::OutOfService),
            'archived' => $count(VehicleStatus::Archived),
            'expiring_licenses' => $this->countByDocumentExpiry(
                Carbon::today(),
                Carbon::today()->addDays(Vehicle::EXPIRY_WARNING_DAYS),
            ),
            'expired_licenses' => $this->countByDocumentExpiry(null, Carbon::yesterday()),
        ];
    }

    public function nextCode(): string
    {
        // Computed in PHP to stay portable across MySQL and PostgreSQL.
        $max = Vehicle::query()
            ->where('vehicle_code', 'like', 'VEH-%')
            ->pluck('vehicle_code')
            ->map(static fn (string $code) => (int) substr($code, 4))
            ->max() ?? 0;

        return sprintf('VEH-%03d', $max + 1);
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function withRelations(): Builder
    {
        return Vehicle::query()
            ->withCount(['maintenanceRecords', 'documents'])
            ->with([
                'shippingCompany',
                'documents',
                'maintenanceRecords',
                'activeAssignment.driver',
                'assignments.driver',
            ]);
    }

    /**
     * Vehicles whose licence or insurance expires inside the given window.
     * A null `from` means "any time up to `to`", i.e. already expired.
     */
    private function countByDocumentExpiry(?Carbon $from, Carbon $to): int
    {
        return Vehicle::query()
            ->where('status', '!=', VehicleStatus::Archived->value)
            ->whereHas('documents', function (Builder $q) use ($from, $to): void {
                $q->whereIn('type', [
                    VehicleDocumentType::License->value,
                    VehicleDocumentType::Insurance->value,
                ])
                    ->whereNotNull('expires_at')
                    ->whereDate('expires_at', '<=', $to);

                if ($from !== null) {
                    $q->whereDate('expires_at', '>=', $from);
                }
            })
            ->count();
    }

    /** @param array<string, mixed> $filters */
    private function applyFilters(Builder $query, array $filters): void
    {
        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function (Builder $q) use ($search): void {
                $q->where('plate_number', 'like', "%{$search}%")
                    ->orWhere('vehicle_code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('manufacturer', 'like', "%{$search}%")
                    ->orWhere('model', 'like', "%{$search}%")
                    ->orWhere('vin', 'like', "%{$search}%");
            });
        }

        $status = $filters['status'] ?? null;
        if ($status !== null && in_array($status, VehicleStatus::values(), true)) {
            $query->where('status', $status);
        } elseif ($status !== 'all') {
            // Default view hides archived vehicles.
            $query->where('status', '!=', VehicleStatus::Archived->value);
        }

        if (! empty($filters['type']) && in_array($filters['type'], VehicleType::values(), true)) {
            $query->where('type', $filters['type']);
        }

        if (! empty($filters['shipping_company_id'])) {
            $query->where('shipping_company_id', (int) $filters['shipping_company_id']);
        }

        if (! empty($filters['branch_id'])) {
            $query->where('branch_id', $filters['branch_id']);
        }

        if (! empty($filters['company_id'])) {
            $query->where('company_id', $filters['company_id']);
        }

        // Documents expiring inside the warning window, or already lapsed.
        if (! empty($filters['expiry'])) {
            $to = $filters['expiry'] === 'expired'
                ? Carbon::yesterday()
                : Carbon::today()->addDays(Vehicle::EXPIRY_WARNING_DAYS);
            $from = $filters['expiry'] === 'expired' ? null : Carbon::today();

            $query->whereHas('documents', function (Builder $q) use ($from, $to): void {
                $q->whereIn('type', [
                    VehicleDocumentType::License->value,
                    VehicleDocumentType::Insurance->value,
                ])
                    ->whereNotNull('expires_at')
                    ->whereDate('expires_at', '<=', $to);

                if ($from !== null) {
                    $q->whereDate('expires_at', '>=', $from);
                }
            });
        }

        // available=1 — free to take a driver right now. Used by the assignment
        // picker in the Drivers module so a taken vehicle is never offered.
        if (filter_var($filters['available'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            $query->where('status', VehicleStatus::Available->value)
                ->whereDoesntHave('assignments', fn (Builder $q) => $q->whereNotNull('active_flag'));
        }

        if (($filters['driver'] ?? null) === 'assigned') {
            $query->whereHas('assignments', fn (Builder $q) => $q->whereNotNull('active_flag'));
        } elseif (($filters['driver'] ?? null) === 'unassigned') {
            $query->whereDoesntHave('assignments', fn (Builder $q) => $q->whereNotNull('active_flag'));
        }
    }
}
