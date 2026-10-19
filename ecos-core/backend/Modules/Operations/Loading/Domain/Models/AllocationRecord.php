<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Operations\Loading\Domain\Enums\AllocationMode;
use Modules\Operations\Loading\Domain\Enums\AllocationRecordStatus;

/**
 * @property string $id
 * @property string $company_id
 * @property string $vehicle_assignment_id
 * @property string $loading_session_id
 * @property string $vehicle_id
 * @property string $order_id
 * @property string $order_line_id
 * @property string $order_number_snapshot
 * @property string|null $order_type_snapshot
 * @property string $product_id
 * @property string $sku_snapshot
 * @property string $vehicle_inventory_item_id
 * @property AllocationMode $allocation_mode
 * @property int $priority_rank
 * @property float $quantity_requested
 * @property float $quantity_allocated
 * @property float $quantity_loaded
 * @property float $quantity_delivered
 * @property float $quantity_remaining
 * @property bool $is_partial
 * @property string|null $partial_reason
 * @property AllocationRecordStatus $status
 * @property \Carbon\Carbon $allocated_at
 * @property string $allocated_by
 * @property string|null $allocated_by_user_id
 * @property string|null $last_decision_id
 * @property string|null $policy_evaluation_id
 * @property string $created_by
 * @property string $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class AllocationRecord extends Model
{
    use HasUuids;

    protected $table = 'allocation_records';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'vehicle_assignment_id',
        'loading_session_id',
        'vehicle_id',
        'order_id',
        'order_line_id',
        'order_number_snapshot',
        'order_type_snapshot',
        'product_id',
        'sku_snapshot',
        'vehicle_inventory_item_id',
        'allocation_mode',
        'priority_rank',
        'quantity_requested',
        'quantity_allocated',
        'quantity_loaded',
        'quantity_delivered',
        'quantity_remaining',
        'is_partial',
        'partial_reason',
        'status',
        'allocated_at',
        'allocated_by',
        'allocated_by_user_id',
        'last_decision_id',
        'policy_evaluation_id',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => AllocationRecordStatus::class,
            'allocation_mode' => AllocationMode::class,
            'priority_rank' => 'integer',
            'quantity_requested' => 'float',
            'quantity_allocated' => 'float',
            'quantity_loaded' => 'float',
            'quantity_delivered' => 'float',
            'quantity_remaining' => 'float',
            'is_partial' => 'boolean',
            'allocated_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<VehicleAssignment, $this> */
    public function vehicleAssignment(): BelongsTo
    {
        return $this->belongsTo(VehicleAssignment::class, 'vehicle_assignment_id');
    }

    /** @return BelongsTo<VehicleInventoryItem, $this> */
    public function vehicleInventoryItem(): BelongsTo
    {
        return $this->belongsTo(VehicleInventoryItem::class, 'vehicle_inventory_item_id');
    }

    /** @return HasMany<AllocationDecision, $this> */
    public function decisions(): HasMany
    {
        return $this->hasMany(AllocationDecision::class, 'allocation_record_id');
    }
}
