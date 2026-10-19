<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Operations\Loading\Domain\Enums\ReconciliationStatus;

/**
 * @property string $id
 * @property string $company_id
 * @property string $vehicle_assignment_id
 * @property string $loading_session_id
 * @property string $vehicle_id
 * @property string $driver_assignment_id
 * @property \Carbon\Carbon $operational_date
 * @property ReconciliationStatus $status
 * @property string|null $reconciled_by
 * @property string|null $approved_by
 * @property bool $has_variance
 * @property string|null $variance_notes
 * @property float $total_quantity_loaded
 * @property float $total_quantity_delivered
 * @property float $total_quantity_returned
 * @property float $total_variance
 * @property string|null $config_version_id
 * @property \Carbon\Carbon $opened_at
 * @property \Carbon\Carbon|null $completed_at
 * @property string $created_by
 * @property string $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class VehicleShiftReconciliation extends Model
{
    use HasUuids;

    protected $table = 'vehicle_shift_reconciliations';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'vehicle_assignment_id',
        'loading_session_id',
        'vehicle_id',
        'driver_assignment_id',
        'operational_date',
        'status',
        'reconciled_by',
        'approved_by',
        'has_variance',
        'variance_notes',
        'total_quantity_loaded',
        'total_quantity_delivered',
        'total_quantity_returned',
        'total_variance',
        'config_version_id',
        'opened_at',
        'completed_at',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => ReconciliationStatus::class,
            'operational_date' => 'date:Y-m-d',
            'has_variance' => 'boolean',
            'total_quantity_loaded' => 'float',
            'total_quantity_delivered' => 'float',
            'total_quantity_returned' => 'float',
            'total_variance' => 'float',
            'opened_at' => 'datetime',
            'completed_at' => 'datetime',
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

    /** @return HasMany<VehicleShiftReconciliationLine, $this> */
    public function lines(): HasMany
    {
        return $this->hasMany(VehicleShiftReconciliationLine::class, 'reconciliation_id');
    }
}
