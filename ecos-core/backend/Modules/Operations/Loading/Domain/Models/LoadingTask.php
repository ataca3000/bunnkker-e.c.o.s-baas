<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Modules\Operations\Loading\Domain\Enums\LoadingTaskStatus;

/**
 * @property string $id
 * @property string $company_id
 * @property string $loading_session_id
 * @property string $vehicle_assignment_id
 * @property string $pool_entry_id
 * @property string $product_id
 * @property string $sku_snapshot
 * @property string $name_snapshot
 * @property string $preparation_wave_id
 * @property float $quantity_planned
 * @property float $quantity_loaded
 * @property float $quantity_short
 * @property LoadingTaskStatus $status
 * @property bool $requires_refrigeration
 * @property string|null $loaded_by
 * @property \Carbon\Carbon|null $loaded_at
 * @property string|null $confirmed_by
 * @property \Carbon\Carbon|null $confirmed_at
 * @property string|null $short_reason
 * @property string|null $notes
 * @property string $created_by
 * @property string $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class LoadingTask extends Model
{
    use HasUuids;

    protected $table = 'loading_tasks';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'loading_session_id',
        'vehicle_assignment_id',
        'pool_entry_id',
        'product_id',
        'sku_snapshot',
        'name_snapshot',
        'preparation_wave_id',
        'quantity_planned',
        'quantity_loaded',
        'quantity_short',
        'status',
        'requires_refrigeration',
        'loaded_by',
        'loaded_at',
        'confirmed_by',
        'confirmed_at',
        'short_reason',
        'notes',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => LoadingTaskStatus::class,
            'quantity_planned' => 'float',
            'quantity_loaded' => 'float',
            'quantity_short' => 'float',
            'requires_refrigeration' => 'boolean',
            'loaded_at' => 'datetime',
            'confirmed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<LoadingSession, $this> */
    public function loadingSession(): BelongsTo
    {
        return $this->belongsTo(LoadingSession::class, 'loading_session_id');
    }

    /** @return BelongsTo<VehicleAssignment, $this> */
    public function vehicleAssignment(): BelongsTo
    {
        return $this->belongsTo(VehicleAssignment::class, 'vehicle_assignment_id');
    }

    /** @return HasOne<VehicleInventoryItem, $this> */
    public function vehicleInventoryItem(): HasOne
    {
        return $this->hasOne(VehicleInventoryItem::class, 'loading_task_id');
    }
}
