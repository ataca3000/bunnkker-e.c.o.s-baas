<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $company_id
 * @property string $vehicle_assignment_id
 * @property \Carbon\Carbon $checked_at
 * @property string $checked_by
 * @property int $orders_count
 * @property float $planned_weight_kg
 * @property float $planned_volume_m3
 * @property float $vehicle_max_weight_kg
 * @property float $vehicle_max_volume_m3
 * @property float $weight_utilization_pct
 * @property float $volume_utilization_pct
 * @property float $order_utilization_pct
 * @property float $overall_utilization_pct
 * @property bool $is_overloaded
 * @property string|null $overload_reason
 * @property int $max_orders_limit
 * @property string|null $policy_evaluation_id
 * @property \Carbon\Carbon $created_at
 * @property string $created_by
 */
class VehicleCapacitySnapshot extends Model
{
    use HasUuids;

    protected $table = 'vehicle_capacity_snapshots';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'vehicle_assignment_id',
        'checked_at',
        'checked_by',
        'orders_count',
        'planned_weight_kg',
        'planned_volume_m3',
        'vehicle_max_weight_kg',
        'vehicle_max_volume_m3',
        'weight_utilization_pct',
        'volume_utilization_pct',
        'order_utilization_pct',
        'overall_utilization_pct',
        'is_overloaded',
        'overload_reason',
        'max_orders_limit',
        'policy_evaluation_id',
        'created_at',
        'created_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'checked_at' => 'datetime',
            'created_at' => 'datetime',
            'orders_count' => 'integer',
            'max_orders_limit' => 'integer',
            'planned_weight_kg' => 'float',
            'planned_volume_m3' => 'float',
            'vehicle_max_weight_kg' => 'float',
            'vehicle_max_volume_m3' => 'float',
            'weight_utilization_pct' => 'float',
            'volume_utilization_pct' => 'float',
            'order_utilization_pct' => 'float',
            'overall_utilization_pct' => 'float',
            'is_overloaded' => 'boolean',
        ];
    }

    /** @return BelongsTo<VehicleAssignment, $this> */
    public function vehicleAssignment(): BelongsTo
    {
        return $this->belongsTo(VehicleAssignment::class, 'vehicle_assignment_id');
    }
}
