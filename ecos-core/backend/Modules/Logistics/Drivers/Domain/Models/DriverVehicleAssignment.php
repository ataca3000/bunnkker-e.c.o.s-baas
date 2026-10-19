<?php

declare(strict_types=1);

namespace Modules\Logistics\Drivers\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;

/**
 * One row per driver↔vehicle pairing over time.
 *
 * `active_flag` is 1 while live and NULL once released; the unique indexes on
 * (driver_id, active_flag) and (vehicle_id, active_flag) turn BR-6 and BR-7
 * into database invariants. History rows are never removed.
 */
class DriverVehicleAssignment extends Model
{
    public const ACTIVE = 1;

    protected $table = 'logistics_driver_vehicle_assignments';

    protected $fillable = [
        'driver_id',
        'vehicle_id',
        'assigned_at',
        'released_at',
        'active_flag',
        'assigned_by',
        'released_by',
        'release_reason',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'assigned_at' => 'datetime',
            'released_at' => 'datetime',
            'active_flag' => 'integer',
        ];
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class, 'driver_id');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id');
    }

    public function isActive(): bool
    {
        return $this->active_flag !== null;
    }

    /** Whole days the pairing lasted; counts to today while still active. */
    public function durationDays(): int
    {
        $end = $this->released_at ?? now();

        return (int) $this->assigned_at->diffInDays($end);
    }
}
