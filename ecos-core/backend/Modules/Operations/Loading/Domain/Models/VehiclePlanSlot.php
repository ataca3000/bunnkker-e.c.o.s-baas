<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Operations\Loading\Domain\Enums\VehiclePlanSlotStatus;

/**
 * @property string $id
 * @property string $company_id
 * @property string $vehicle_plan_id
 * @property int $slot_number
 * @property string|null $vehicle_id
 * @property string|null $vehicle_registration_snapshot
 * @property string|null $vehicle_type_snapshot
 * @property float|null $capacity_weight_kg
 * @property float|null $capacity_volume_m3
 * @property int $order_count
 * @property float $total_weight_kg
 * @property float $total_volume_m3
 * @property float $utilization_pct
 * @property bool $is_overloaded
 * @property bool $requires_refrigeration
 * @property \Carbon\Carbon|null $vehicle_assigned_at
 * @property string|null $vehicle_assigned_by
 * @property VehiclePlanSlotStatus $status
 * @property string|null $notes
 * @property string $created_by
 * @property string $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class VehiclePlanSlot extends Model
{
    use HasUuids;

    protected $table = 'vehicle_plan_slots';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'vehicle_plan_id',
        'slot_number',
        'vehicle_id',
        'vehicle_registration_snapshot',
        'vehicle_type_snapshot',
        'capacity_weight_kg',
        'capacity_volume_m3',
        'order_count',
        'total_weight_kg',
        'total_volume_m3',
        'utilization_pct',
        'is_overloaded',
        'requires_refrigeration',
        'vehicle_assigned_at',
        'vehicle_assigned_by',
        'status',
        'notes',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => VehiclePlanSlotStatus::class,
            'slot_number' => 'integer',
            'order_count' => 'integer',
            'capacity_weight_kg' => 'float',
            'capacity_volume_m3' => 'float',
            'total_weight_kg' => 'float',
            'total_volume_m3' => 'float',
            'utilization_pct' => 'float',
            'is_overloaded' => 'boolean',
            'requires_refrigeration' => 'boolean',
            'vehicle_assigned_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<VehiclePlan, $this> */
    public function vehiclePlan(): BelongsTo
    {
        return $this->belongsTo(VehiclePlan::class, 'vehicle_plan_id');
    }

    /** @return HasMany<VehiclePlanSlotOrder, $this> */
    public function slotOrders(): HasMany
    {
        return $this->hasMany(VehiclePlanSlotOrder::class, 'vehicle_plan_slot_id');
    }
}
