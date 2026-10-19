<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $company_id
 * @property string $route_plan_id
 * @property string $vehicle_assignment_id
 * @property string $order_id
 * @property string $order_number_snapshot
 * @property string|null $customer_name_snapshot
 * @property string|null $delivery_address_snapshot
 * @property string|null $zone_id_snapshot
 * @property int $stop_sequence
 * @property \Carbon\Carbon|null $planned_arrival_at
 * @property \Carbon\Carbon|null $actual_arrival_at
 * @property \Carbon\Carbon|null $actual_departure_at
 * @property string $status
 * @property string|null $failure_reason
 * @property float|null $distance_from_prev_km
 * @property string|null $notes
 * @property string $created_by
 * @property string $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class RoutePlanStop extends Model
{
    use HasUuids;

    protected $table = 'route_plan_stops';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'route_plan_id',
        'vehicle_assignment_id',
        'order_id',
        'order_number_snapshot',
        'customer_name_snapshot',
        'delivery_address_snapshot',
        'zone_id_snapshot',
        'stop_sequence',
        'planned_arrival_at',
        'actual_arrival_at',
        'actual_departure_at',
        'status',
        'failure_reason',
        'distance_from_prev_km',
        'notes',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'stop_sequence' => 'integer',
            'distance_from_prev_km' => 'float',
            'planned_arrival_at' => 'datetime',
            'actual_arrival_at' => 'datetime',
            'actual_departure_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<RoutePlan, $this> */
    public function routePlan(): BelongsTo
    {
        return $this->belongsTo(RoutePlan::class, 'route_plan_id');
    }

    /** @return BelongsTo<VehicleAssignment, $this> */
    public function vehicleAssignment(): BelongsTo
    {
        return $this->belongsTo(VehicleAssignment::class, 'vehicle_assignment_id');
    }
}
