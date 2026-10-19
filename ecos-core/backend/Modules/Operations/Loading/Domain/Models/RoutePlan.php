<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Operations\Loading\Domain\Enums\RoutePlanStatus;

/**
 * @property string $id
 * @property string $company_id
 * @property string $vehicle_assignment_id
 * @property string $loading_session_id
 * @property string $vehicle_id
 * @property string $driver_assignment_id
 * @property string $route_number
 * @property RoutePlanStatus $status
 * @property int $version
 * @property string|null $superseded_by_id
 * @property int $stops_count
 * @property float|null $total_distance_km
 * @property int|null $estimated_duration_min
 * @property float|null $optimization_score
 * @property string|null $optimization_algorithm
 * @property \Carbon\Carbon|null $planned_departure_at
 * @property \Carbon\Carbon|null $actual_departure_at
 * @property \Carbon\Carbon|null $actual_return_at
 * @property \Carbon\Carbon|null $completed_at
 * @property \Carbon\Carbon|null $cancelled_at
 * @property string|null $cancelled_by
 * @property string|null $notes
 * @property string $created_by
 * @property string $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class RoutePlan extends Model
{
    use HasUuids;

    protected $table = 'route_plans';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'vehicle_assignment_id',
        'loading_session_id',
        'vehicle_id',
        'driver_assignment_id',
        'route_number',
        'status',
        'version',
        'superseded_by_id',
        'stops_count',
        'total_distance_km',
        'estimated_duration_min',
        'optimization_score',
        'optimization_algorithm',
        'planned_departure_at',
        'actual_departure_at',
        'actual_return_at',
        'completed_at',
        'cancelled_at',
        'cancelled_by',
        'notes',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => RoutePlanStatus::class,
            'version' => 'integer',
            'stops_count' => 'integer',
            'estimated_duration_min' => 'integer',
            'total_distance_km' => 'float',
            'optimization_score' => 'float',
            'planned_departure_at' => 'datetime',
            'actual_departure_at' => 'datetime',
            'actual_return_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<VehicleAssignment, $this> */
    public function vehicleAssignment(): BelongsTo
    {
        return $this->belongsTo(VehicleAssignment::class, 'vehicle_assignment_id');
    }

    /** @return BelongsTo<DriverAssignment, $this> */
    public function driverAssignment(): BelongsTo
    {
        return $this->belongsTo(DriverAssignment::class, 'driver_assignment_id');
    }

    /** @return HasMany<RoutePlanStop, $this> */
    public function stops(): HasMany
    {
        return $this->hasMany(RoutePlanStop::class, 'route_plan_id');
    }
}
