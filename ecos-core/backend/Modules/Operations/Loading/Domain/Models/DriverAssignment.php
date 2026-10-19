<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Operations\Loading\Domain\Enums\DriverAssignmentStatus;
use Modules\Operations\Loading\Domain\Enums\DriverAssignmentType;

/**
 * @property string $id
 * @property string $company_id
 * @property string $vehicle_assignment_id
 * @property string $loading_session_id
 * @property string $vehicle_id
 * @property string $driver_id
 * @property string $driver_name_snapshot
 * @property string|null $driver_phone_snapshot
 * @property DriverAssignmentStatus $status
 * @property DriverAssignmentType $assignment_type
 * @property \Carbon\Carbon $assigned_at
 * @property string $assigned_by
 * @property \Carbon\Carbon|null $departure_time_planned
 * @property \Carbon\Carbon|null $departure_time_actual
 * @property \Carbon\Carbon|null $return_time_actual
 * @property \Carbon\Carbon|null $reassigned_at
 * @property string|null $reassigned_by
 * @property string|null $reassignment_reason
 * @property \Carbon\Carbon|null $cancelled_at
 * @property string|null $cancelled_by
 * @property string|null $cancellation_reason
 * @property string|null $notes
 * @property string $created_by
 * @property string $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class DriverAssignment extends Model
{
    use HasUuids;

    protected $table = 'driver_assignments';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'vehicle_assignment_id',
        'loading_session_id',
        'vehicle_id',
        'driver_id',
        'driver_name_snapshot',
        'driver_phone_snapshot',
        'status',
        'assignment_type',
        'assigned_at',
        'assigned_by',
        'departure_time_planned',
        'departure_time_actual',
        'return_time_actual',
        'reassigned_at',
        'reassigned_by',
        'reassignment_reason',
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
            'status' => DriverAssignmentStatus::class,
            'assignment_type' => DriverAssignmentType::class,
            'assigned_at' => 'datetime',
            'departure_time_planned' => 'datetime',
            'departure_time_actual' => 'datetime',
            'return_time_actual' => 'datetime',
            'reassigned_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<VehicleAssignment, $this> */
    public function vehicleAssignment(): BelongsTo
    {
        return $this->belongsTo(VehicleAssignment::class, 'vehicle_assignment_id');
    }
}
