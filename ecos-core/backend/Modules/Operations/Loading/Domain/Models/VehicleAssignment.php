<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Modules\Operations\Loading\Domain\Enums\VehicleAssignmentStatus;

/**
 * @property string $id
 * @property string $company_id
 * @property string $loading_session_id
 * @property string|null $vehicle_plan_slot_id
 * @property string $vehicle_id
 * @property string $vehicle_registration_snapshot
 * @property string $vehicle_type_snapshot
 * @property float $capacity_weight_kg_snapshot
 * @property float $capacity_volume_m3_snapshot
 * @property bool $refrigerated_snapshot
 * @property string $assignment_number
 * @property VehicleAssignmentStatus $status
 * @property int $orders_count
 * @property float $loading_weight_kg
 * @property float $loading_volume_m3
 * @property \Carbon\Carbon|null $loading_started_at
 * @property \Carbon\Carbon|null $loading_completed_at
 * @property \Carbon\Carbon|null $dispatched_at
 * @property string|null $dispatched_by
 * @property \Carbon\Carbon|null $returned_at
 * @property \Carbon\Carbon|null $reconciled_at
 * @property \Carbon\Carbon|null $cancelled_at
 * @property string|null $cancelled_by
 * @property string|null $cancellation_reason
 * @property string|null $notes
 * @property string $created_by
 * @property string $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class VehicleAssignment extends Model
{
    use HasUuids;

    protected $table = 'vehicle_assignments';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'loading_session_id',
        'vehicle_plan_slot_id',
        'vehicle_id',
        'vehicle_registration_snapshot',
        'vehicle_type_snapshot',
        'capacity_weight_kg_snapshot',
        'capacity_volume_m3_snapshot',
        'refrigerated_snapshot',
        'assignment_number',
        'status',
        'orders_count',
        'loading_weight_kg',
        'loading_volume_m3',
        'loading_started_at',
        'loading_completed_at',
        'dispatched_at',
        'dispatched_by',
        'returned_at',
        'reconciled_at',
        'cancelled_at',
        'cancelled_by',
        'cancellation_reason',
        'notes',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => VehicleAssignmentStatus::class,
            'orders_count' => 'integer',
            'capacity_weight_kg_snapshot' => 'float',
            'capacity_volume_m3_snapshot' => 'float',
            'refrigerated_snapshot' => 'boolean',
            'loading_weight_kg' => 'float',
            'loading_volume_m3' => 'float',
            'loading_started_at' => 'datetime',
            'loading_completed_at' => 'datetime',
            'dispatched_at' => 'datetime',
            'returned_at' => 'datetime',
            'reconciled_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<LoadingSession, $this> */
    public function loadingSession(): BelongsTo
    {
        return $this->belongsTo(LoadingSession::class, 'loading_session_id');
    }

    /** @return HasMany<LoadingTask, $this> */
    public function loadingTasks(): HasMany
    {
        return $this->hasMany(LoadingTask::class, 'vehicle_assignment_id');
    }

    /** @return HasMany<AllocationRecord, $this> */
    public function allocationRecords(): HasMany
    {
        return $this->hasMany(AllocationRecord::class, 'vehicle_assignment_id');
    }

    /** @return HasMany<VehicleInventoryItem, $this> */
    public function vehicleInventoryItems(): HasMany
    {
        return $this->hasMany(VehicleInventoryItem::class, 'vehicle_assignment_id');
    }

    /** @return HasMany<LoadingException, $this> */
    public function loadingExceptions(): HasMany
    {
        return $this->hasMany(LoadingException::class, 'vehicle_assignment_id');
    }

    /** @return HasOne<DriverAssignment, $this> */
    public function driverAssignment(): HasOne
    {
        return $this->hasOne(DriverAssignment::class, 'vehicle_assignment_id');
    }

    /** @return HasOne<VehicleCapacitySnapshot, $this> */
    public function capacitySnapshot(): HasOne
    {
        return $this->hasOne(VehicleCapacitySnapshot::class, 'vehicle_assignment_id');
    }

    /** @return HasOne<RoutePlan, $this> */
    public function routePlan(): HasOne
    {
        return $this->hasOne(RoutePlan::class, 'vehicle_assignment_id');
    }

    /** @return HasOne<VehicleShiftReconciliation, $this> */
    public function shiftReconciliation(): HasOne
    {
        return $this->hasOne(VehicleShiftReconciliation::class, 'vehicle_assignment_id');
    }
}
