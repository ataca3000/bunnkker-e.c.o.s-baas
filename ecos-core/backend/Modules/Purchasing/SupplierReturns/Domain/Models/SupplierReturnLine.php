<?php

declare(strict_types=1);

namespace Modules\Purchasing\SupplierReturns\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Inventory\Products\Domain\Models\Product;

class SupplierReturnLine extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'supplier_return_id',
        'product_id',
        'goods_receipt_line_id',
        'return_quantity',
        'unit_cost',
        'total_cost',
        'reason',
        'quality_condition',
        'notes',
        'uom_name_snapshot',
        'uom_symbol_snapshot',
        'original_received_qty',
        'original_unit_cost',
    ];

    protected $casts = [
        'return_quantity' => 'decimal:4',
        'unit_cost' => 'decimal:4',
        'total_cost' => 'decimal:4',
        'original_received_qty' => 'decimal:4',
        'original_unit_cost' => 'decimal:4',
    ];

    public function supplierReturn(): BelongsTo
    {
        return $this->belongsTo(SupplierReturn::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
