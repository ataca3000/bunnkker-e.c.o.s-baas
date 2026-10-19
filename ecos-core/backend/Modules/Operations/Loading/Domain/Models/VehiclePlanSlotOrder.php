<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $company_id
 * @property string $vehicle_plan_slot_id
 * @property string $vehicle_plan_id
 * @property string $order_id
 * @property string $order_number_snapshot
 * @property string|null $order_type_snapshot
 * @property string|null $channel_id_snapshot
 * @property string|null $zone_id_snapshot
 * @property float $estimated_weight_kg
 * @property float $estimated_volume_m3
 * @property int|null $stop_sequence
 * @property \Carbon\Carbon $added_at
 * @property string $added_by
 * @property string|null $moved_from_slot_id
 */
class VehiclePlanSlotOrder extends Model
{
    use HasUuids;

    protected $table = 'vehicle_plan_slot_orders';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'vehicle_plan_slot_id',
        'vehicle_plan_id',
        'order_id',
        'order_number_snapshot',
        'order_type_snapshot',
        'channel_id_snapshot',
        'zone_id_snapshot',
        'estimated_weight_kg',
        'estimated_volume_m3',
        'stop_sequence',
        'added_at',
        'added_by',
        'moved_from_slot_id',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'estimated_weight_kg' => 'float',
            'estimated_volume_m3' => 'float',
            'stop_sequence' => 'integer',
            'added_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<VehiclePlanSlot, $this> */
    public function slot(): BelongsTo
    {
        return $this->belongsTo(VehiclePlanSlot::class, 'vehicle_plan_slot_id');
    }

    /** @return BelongsTo<VehiclePlan, $this> */
    public function vehiclePlan(): BelongsTo
    {
        return $this->belongsTo(VehiclePlan::class, 'vehicle_plan_id');
    }
}
