<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Operations\Loading\Domain\Enums\VehicleInventoryItemStatus;

/**
 * @property string $id
 * @property string $company_id
 * @property string $vehicle_assignment_id
 * @property string $vehicle_id
 * @property string $product_id
 * @property string $sku_snapshot
 * @property string $name_snapshot
 * @property \Carbon\Carbon $operational_date
 * @property string $pool_entry_id
 * @property string $loading_task_id
 * @property float $quantity_loaded
 * @property float $quantity_allocated
 * @property float $quantity_delivered
 * @property float $quantity_returned
 * @property float $quantity_on_hand
 * @property float $quantity_unallocated
 * @property bool $requires_refrigeration
 * @property VehicleInventoryItemStatus $status
 * @property \Carbon\Carbon $last_movement_at
 * @property string $created_by
 * @property string $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class VehicleInventoryItem extends Model
{
    use HasUuids;

    protected $table = 'vehicle_inventory_items';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'vehicle_assignment_id',
        'vehicle_id',
        'product_id',
        'sku_snapshot',
        'name_snapshot',
        'operational_date',
        'pool_entry_id',
        'loading_task_id',
        'quantity_loaded',
        'quantity_allocated',
        'quantity_delivered',
        'quantity_returned',
        'quantity_on_hand',
        'quantity_unallocated',
        'requires_refrigeration',
        'status',
        'last_movement_at',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => VehicleInventoryItemStatus::class,
            'operational_date' => 'date:Y-m-d',
            'quantity_loaded' => 'float',
            'quantity_allocated' => 'float',
            'quantity_delivered' => 'float',
            'quantity_returned' => 'float',
            'quantity_on_hand' => 'float',
            'quantity_unallocated' => 'float',
            'requires_refrigeration' => 'boolean',
            'last_movement_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<VehicleAssignment, $this> */
    public function vehicleAssignment(): BelongsTo
    {
        return $this->belongsTo(VehicleAssignment::class, 'vehicle_assignment_id');
    }

    /** @return BelongsTo<LoadingTask, $this> */
    public function loadingTask(): BelongsTo
    {
        return $this->belongsTo(LoadingTask::class, 'loading_task_id');
    }

    /** @return HasMany<VehicleInventoryMovement, $this> */
    public function movements(): HasMany
    {
        return $this->hasMany(VehicleInventoryMovement::class, 'vehicle_inventory_item_id');
    }

    /** @return HasMany<AllocationRecord, $this> */
    public function allocationRecords(): HasMany
    {
        return $this->hasMany(AllocationRecord::class, 'vehicle_inventory_item_id');
    }

    /** @return HasMany<VehicleShiftReconciliationLine, $this> */
    public function reconciliationLines(): HasMany
    {
        return $this->hasMany(VehicleShiftReconciliationLine::class, 'vehicle_inventory_item_id');
    }
}
