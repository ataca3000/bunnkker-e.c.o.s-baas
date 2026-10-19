<?php

declare(strict_types=1);

namespace Modules\Logistics\Vehicles\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Modules\Logistics\Vehicles\Domain\Enums\MaintenanceType;

/**
 * A single maintenance event against a vehicle.
 *
 * BR-8 — immutable after creation. Amendments are only possible for users
 * holding the maintenance-management permission and always stamp
 * amended_by/amended_at, so no edit is anonymous.
 */
class VehicleMaintenanceRecord extends Model
{
    protected $table = 'logistics_vehicle_maintenance_records';

    protected $fillable = [
        'uuid',
        'vehicle_id',
        'performed_on',
        'type',
        'description',
        'cost',
        'currency',
        'vendor',
        'next_maintenance_date',
        'notes',
        'recorded_by',
        'amended_by',
        'amended_at',
    ];

    protected function casts(): array
    {
        return [
            'type' => MaintenanceType::class,
            'performed_on' => 'date:Y-m-d',
            'next_maintenance_date' => 'date:Y-m-d',
            'amended_at' => 'datetime',
            'cost' => 'decimal:2',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $record): void {
            if ($record->uuid === null) {
                $record->uuid = (string) Str::uuid();
            }
        });
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id');
    }

    public function wasAmended(): bool
    {
        return $this->amended_at !== null;
    }

    public function isNextServiceDue(): bool
    {
        return $this->next_maintenance_date !== null
            && $this->next_maintenance_date->lte(Carbon::today());
    }
}
