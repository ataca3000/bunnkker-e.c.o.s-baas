<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;

/**
 * Immutable audit record for every manual warehouse override.
 *
 * @property string $id
 * @property string $order_id
 * @property string|null $previous_warehouse_id
 * @property string $new_warehouse_id
 * @property string $reason
 * @property string $overridden_by
 * @property \Carbon\Carbon $overridden_at
 */
class WarehouseAssignmentOverride extends Model
{
    use HasUuids;

    protected $table = 'warehouse_assignment_overrides';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'order_id',
        'previous_warehouse_id',
        'new_warehouse_id',
        'reason',
        'overridden_by',
        'overridden_at',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'overridden_at' => 'datetime',
    ];

    public function newWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'new_warehouse_id');
    }

    public function previousWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'previous_warehouse_id');
    }
}
