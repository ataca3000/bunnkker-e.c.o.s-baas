<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $company_id
 * @property string $vehicle_plan_id
 * @property string $action_type
 * @property string $actor_id
 * @property string|null $slot_id_from
 * @property string|null $slot_id_to
 * @property string|null $order_id
 * @property string|null $vehicle_id_before
 * @property string|null $vehicle_id_after
 * @property array|null $before_state
 * @property array|null $after_state
 * @property string $reason
 * @property \Carbon\Carbon $recorded_at
 */
class VehiclePlanAdjustmentLog extends Model
{
    protected $table = 'vehicle_plan_adjustment_log';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    /** @var list<string> */
    protected $fillable = [
        'id',
        'company_id',
        'vehicle_plan_id',
        'action_type',
        'actor_id',
        'slot_id_from',
        'slot_id_to',
        'order_id',
        'vehicle_id_before',
        'vehicle_id_after',
        'before_state',
        'after_state',
        'reason',
        'recorded_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'before_state' => 'array',
            'after_state' => 'array',
            'recorded_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<VehiclePlan, $this> */
    public function vehiclePlan(): BelongsTo
    {
        return $this->belongsTo(VehiclePlan::class, 'vehicle_plan_id');
    }
}
