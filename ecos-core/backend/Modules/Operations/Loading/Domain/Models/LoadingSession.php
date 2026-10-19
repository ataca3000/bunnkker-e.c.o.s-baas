<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Operations\Loading\Domain\Enums\LoadingSessionStatus;
use Modules\Operations\Loading\Domain\Enums\SessionType;

/**
 * @property string $id
 * @property string $company_id
 * @property string $warehouse_id
 * @property string $session_number
 * @property \Carbon\Carbon $operational_date
 * @property string|null $vehicle_plan_id
 * @property LoadingSessionStatus $status
 * @property SessionType $session_type
 * @property int $vehicles_count
 * @property int $orders_count
 * @property int $products_count
 * @property float $total_units_to_load
 * @property float $total_units_loaded
 * @property \Carbon\Carbon|null $loading_started_at
 * @property string|null $loading_started_by
 * @property \Carbon\Carbon|null $loading_completed_at
 * @property string|null $loading_completed_by
 * @property \Carbon\Carbon|null $allocation_started_at
 * @property \Carbon\Carbon|null $allocation_completed_at
 * @property \Carbon\Carbon|null $dispatched_at
 * @property string|null $dispatched_by
 * @property \Carbon\Carbon|null $cancelled_at
 * @property string|null $cancelled_by
 * @property string|null $cancellation_reason
 * @property string|null $config_version_id
 * @property string|null $supervisor_id
 * @property string|null $notes
 * @property string $created_by
 * @property string $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class LoadingSession extends Model
{
    use HasUuids;

    protected $table = 'loading_sessions';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'warehouse_id',
        'session_number',
        'operational_date',
        'vehicle_plan_id',
        'status',
        'session_type',
        'vehicles_count',
        'orders_count',
        'products_count',
        'total_units_to_load',
        'total_units_loaded',
        'loading_started_at',
        'loading_started_by',
        'loading_completed_at',
        'loading_completed_by',
        'allocation_started_at',
        'allocation_completed_at',
        'dispatched_at',
        'dispatched_by',
        'cancelled_at',
        'cancelled_by',
        'cancellation_reason',
        'config_version_id',
        'supervisor_id',
        'notes',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => LoadingSessionStatus::class,
            'session_type' => SessionType::class,
            'operational_date' => 'date:Y-m-d',
            'vehicles_count' => 'integer',
            'orders_count' => 'integer',
            'products_count' => 'integer',
            'total_units_to_load' => 'float',
            'total_units_loaded' => 'float',
            'loading_started_at' => 'datetime',
            'loading_completed_at' => 'datetime',
            'allocation_started_at' => 'datetime',
            'allocation_completed_at' => 'datetime',
            'dispatched_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    /** @return HasMany<VehicleAssignment, $this> */
    public function vehicleAssignments(): HasMany
    {
        return $this->hasMany(VehicleAssignment::class, 'loading_session_id');
    }

    /** @return HasMany<LoadingTask, $this> */
    public function loadingTasks(): HasMany
    {
        return $this->hasMany(LoadingTask::class, 'loading_session_id');
    }

    /** @return HasMany<LoadingException, $this> */
    public function loadingExceptions(): HasMany
    {
        return $this->hasMany(LoadingException::class, 'loading_session_id');
    }

    /** @return HasMany<ShipmentGroup, $this> */
    public function shipmentGroups(): HasMany
    {
        return $this->hasMany(ShipmentGroup::class, 'loading_session_id');
    }
}
