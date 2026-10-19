<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $company_id
 * @property string $reconciliation_id
 * @property string $vehicle_inventory_item_id
 * @property string $product_id
 * @property string $sku_snapshot
 * @property float $quantity_loaded
 * @property float $quantity_delivered
 * @property float $quantity_returned_expected
 * @property float $quantity_returned_actual
 * @property float $variance
 * @property string|null $variance_resolution
 * @property string|null $resolution_notes
 * @property string|null $resolved_by
 * @property \Carbon\Carbon|null $resolved_at
 * @property string $created_by
 * @property string $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class VehicleShiftReconciliationLine extends Model
{
    use HasUuids;

    protected $table = 'vehicle_shift_reconciliation_lines';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'reconciliation_id',
        'vehicle_inventory_item_id',
        'product_id',
        'sku_snapshot',
        'quantity_loaded',
        'quantity_delivered',
        'quantity_returned_expected',
        'quantity_returned_actual',
        'variance',
        'variance_resolution',
        'resolution_notes',
        'resolved_by',
        'resolved_at',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'quantity_loaded' => 'float',
            'quantity_delivered' => 'float',
            'quantity_returned_expected' => 'float',
            'quantity_returned_actual' => 'float',
            'variance' => 'float',
            'resolved_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<VehicleShiftReconciliation, $this> */
    public function reconciliation(): BelongsTo
    {
        return $this->belongsTo(VehicleShiftReconciliation::class, 'reconciliation_id');
    }

    /** @return BelongsTo<VehicleInventoryItem, $this> */
    public function vehicleInventoryItem(): BelongsTo
    {
        return $this->belongsTo(VehicleInventoryItem::class, 'vehicle_inventory_item_id');
    }
}
