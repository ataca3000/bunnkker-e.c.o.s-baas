<?php

declare(strict_types=1);

namespace Modules\Inventory\WarehouseLiabilities\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Inventory\CountSessions\Domain\Models\InventoryCountLine;
use Modules\Inventory\CountSessions\Domain\Models\InventoryCountSession;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Inventory\WarehouseLiabilities\Domain\Enums\WarehouseLiabilityStatus;
use Modules\Inventory\WasteInvestigations\Domain\Models\WasteInvestigation;
use Modules\Organization\Warehouses\Domain\Models\Warehouse;

class WarehouseLiability extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'warehouse_id',
        'product_id',
        'count_session_id',
        'count_line_id',
        'waste_investigation_id',
        'warehouse_manager',
        'liability_type',
        'quantity',
        'unit_cost',
        'total_cost',
        'status',
        'approved_by',
        'approved_at',
        'notes',
        'month',
        // Immutable cost snapshot — captured at approval time from FIFO engine
        'cost_snapshot_unit_cost',
        'cost_snapshot_total_value',
        'cost_method',
        'currency',
        // Future-integration extension point (Accounting journal, HR payroll, AI)
        'metadata',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'unit_cost' => 'decimal:4',
            'total_cost' => 'decimal:2',
            'cost_snapshot_unit_cost' => 'decimal:4',
            'cost_snapshot_total_value' => 'decimal:2',
            'status' => WarehouseLiabilityStatus::class,
            'approved_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    /** Whether a FIFO cost snapshot has been captured (i.e. liability was approved). */
    public function hasCostSnapshot(): bool
    {
        return $this->cost_snapshot_unit_cost !== null;
    }

    /** @return BelongsTo<InventoryCountSession, $this> */
    public function countSession(): BelongsTo
    {
        return $this->belongsTo(InventoryCountSession::class, 'count_session_id');
    }

    /** @return BelongsTo<InventoryCountLine, $this> */
    public function countLine(): BelongsTo
    {
        return $this->belongsTo(InventoryCountLine::class, 'count_line_id');
    }

    /** @return BelongsTo<WasteInvestigation, $this> */
    public function wasteInvestigation(): BelongsTo
    {
        return $this->belongsTo(WasteInvestigation::class, 'waste_investigation_id');
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** @return BelongsTo<Warehouse, $this> */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }
}
