<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Operations\Loading\Domain\Enums\VehiclePlanStatus;

/**
 * @property string $id
 * @property string $company_id
 * @property \Carbon\Carbon $operational_date
 * @property string $plan_number
 * @property string|null $geography_group_id
 * @property string $shipping_company_id
 * @property string $zone_id
 * @property string $governorate_id
 * @property VehiclePlanStatus $status
 * @property string $distribution_policy
 * @property int $version
 * @property string|null $superseded_by_id
 * @property int $slots_count
 * @property int $orders_count
 * @property float $total_weight_kg
 * @property float $total_volume_m3
 * @property \Carbon\Carbon|null $proposed_at
 * @property string|null $proposed_by
 * @property \Carbon\Carbon|null $approved_at
 * @property string|null $approved_by
 * @property \Carbon\Carbon|null $cancelled_at
 * @property string|null $cancelled_by
 * @property string|null $cancellation_reason
 * @property string|null $replan_trigger
 * @property string|null $notes
 * @property string $created_by
 * @property string $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class VehiclePlan extends Model
{
    use HasUuids;

    protected $table = 'vehicle_plans';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'operational_date',
        'plan_number',
        'geography_group_id',
        'shipping_company_id',
        'zone_id',
        'governorate_id',
        'status',
        'distribution_policy',
        'version',
        'superseded_by_id',
        'slots_count',
        'orders_count',
        'total_weight_kg',
        'total_volume_m3',
        'proposed_at',
        'proposed_by',
        'approved_at',
        'approved_by',
        'cancelled_at',
        'cancelled_by',
        'cancellation_reason',
        'replan_trigger',
        'notes',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => VehiclePlanStatus::class,
            'operational_date' => 'date:Y-m-d',
            'version' => 'integer',
            'slots_count' => 'integer',
            'orders_count' => 'integer',
            'total_weight_kg' => 'float',
            'total_volume_m3' => 'float',
            'proposed_at' => 'datetime',
            'approved_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    /** @return HasMany<VehiclePlanSlot, $this> */
    public function slots(): HasMany
    {
        return $this->hasMany(VehiclePlanSlot::class, 'vehicle_plan_id');
    }

    /** @return HasMany<VehiclePlanAdjustmentLog, $this> */
    public function adjustmentLog(): HasMany
    {
        return $this->hasMany(VehiclePlanAdjustmentLog::class, 'vehicle_plan_id');
    }
}
