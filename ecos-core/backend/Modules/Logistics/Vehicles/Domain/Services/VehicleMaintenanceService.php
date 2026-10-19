<?php

declare(strict_types=1);

namespace Modules\Logistics\Vehicles\Domain\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Modules\Logistics\Vehicles\Domain\Events\VehicleMaintenanceRecorded;
use Modules\Logistics\Vehicles\Domain\Exceptions\VehicleException;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;
use Modules\Logistics\Vehicles\Domain\Models\VehicleMaintenanceRecord;

/**
 * Maintenance ledger rules.
 *
 * BR-8 — a record is immutable once written. Only a user holding the
 * maintenance-management permission (or a system role) may amend one, and any
 * amendment is stamped so it is never anonymous.
 */
class VehicleMaintenanceService
{
    public const PERMISSION_MODULE = 'logistics';

    public const PERMISSION_RESOURCE = 'vehicle_maintenance';

    public const PERMISSION_ACTION = 'manage';

    /** @param array<string, mixed> $attributes */
    public function record(Vehicle $vehicle, array $attributes, ?string $actor = null): VehicleMaintenanceRecord
    {
        $record = DB::transaction(fn () => $vehicle->maintenanceRecords()->create(
            $attributes + ['recorded_by' => $actor]
        ));

        VehicleMaintenanceRecorded::dispatch($vehicle, $record, $actor);

        return $record;
    }

    /**
     * Amend an existing record. Throws unless the caller may manage maintenance.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function amend(
        VehicleMaintenanceRecord $record,
        array $attributes,
        ?User $user,
        ?string $actor = null,
    ): VehicleMaintenanceRecord {
        if (! $this->canManage($user)) {
            throw VehicleException::maintenanceImmutable();
        }

        return DB::transaction(function () use ($record, $attributes, $actor) {
            $record->update($attributes + [
                'amended_by' => $actor,
                'amended_at' => now(),
            ]);

            return $record->refresh();
        });
    }

    public function delete(VehicleMaintenanceRecord $record, ?User $user): void
    {
        if (! $this->canManage($user)) {
            throw VehicleException::maintenanceImmutable();
        }

        $record->delete();
    }

    /**
     * True when the user holds a system role or the explicit
     * logistics / vehicle_maintenance / manage permission.
     */
    public function canManage(?User $user): bool
    {
        if ($user === null) {
            return false;
        }

        if ($user->roles()->where('is_system', true)->exists()) {
            return true;
        }

        return $user->roles()
            ->whereHas('permissions', function ($q): void {
                $q->where('module', self::PERMISSION_MODULE)
                    ->where('resource', self::PERMISSION_RESOURCE)
                    ->where('action', self::PERMISSION_ACTION);
            })
            ->exists();
    }
}
