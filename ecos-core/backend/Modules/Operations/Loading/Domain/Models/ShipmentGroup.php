<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Operations\Loading\Domain\Enums\ShipmentGroupStatus;

/**
 * @property string $id
 * @property string $company_id
 * @property string $loading_session_id
 * @property string|null $geography_group_id
 * @property string $shipping_company_id
 * @property string $zone_id
 * @property string $governorate_id
 * @property string $group_number
 * @property ShipmentGroupStatus $status
 * @property int $vehicle_assignments_count
 * @property int $orders_count
 * @property int $fully_allocated_orders
 * @property int $partially_allocated_orders
 * @property int $unallocated_orders
 * @property float $allocation_coverage_pct
 * @property \Carbon\Carbon|null $dispatched_at
 * @property \Carbon\Carbon|null $completed_at
 * @property \Carbon\Carbon|null $cancelled_at
 * @property string|null $notes
 * @property string $created_by
 * @property string $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class ShipmentGroup extends Model
{
    use HasUuids;

    protected $table = 'shipment_groups';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'loading_session_id',
        'geography_group_id',
        'shipping_company_id',
        'zone_id',
        'governorate_id',
        'group_number',
        'status',
        'vehicle_assignments_count',
        'orders_count',
        'fully_allocated_orders',
        'partially_allocated_orders',
        'unallocated_orders',
        'allocation_coverage_pct',
        'dispatched_at',
        'completed_at',
        'cancelled_at',
        'notes',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => ShipmentGroupStatus::class,
            'vehicle_assignments_count' => 'integer',
            'orders_count' => 'integer',
            'fully_allocated_orders' => 'integer',
            'partially_allocated_orders' => 'integer',
            'unallocated_orders' => 'integer',
            'allocation_coverage_pct' => 'float',
            'dispatched_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<LoadingSession, $this> */
    public function loadingSession(): BelongsTo
    {
        return $this->belongsTo(LoadingSession::class, 'loading_session_id');
    }

    /** @return HasMany<ShipmentGroupItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(ShipmentGroupItem::class, 'shipment_group_id');
    }
}
