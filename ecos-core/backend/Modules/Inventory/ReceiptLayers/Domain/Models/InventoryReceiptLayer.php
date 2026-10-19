<?php

declare(strict_types=1);

namespace Modules\Inventory\ReceiptLayers\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceipt;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceiptLine;
use Modules\Purchasing\Suppliers\Domain\Models\Supplier;

/**
 * Inventory receipt layer — tracks inventory quantity by supplier, receipt, and product.
 * Each posted Goods Receipt line creates one layer.
 * remaining_qty is the FIFO-consumption hook: it starts equal to received_qty and
 * decreases as inventory is shipped (future FIFO implementation).
 *
 * @property string $id
 * @property string|null $company_id
 * @property string $supplier_id
 * @property string $product_id
 * @property string $goods_receipt_id
 * @property string $goods_receipt_line_id
 * @property string $warehouse_id
 * @property numeric-string $received_qty
 * @property numeric-string $remaining_qty
 * @property numeric-string $landed_unit_cost
 * @property numeric-string|null $sale_price_snapshot
 * @property string $receipt_date
 */
class InventoryReceiptLayer extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'supplier_id',
        'product_id',
        'goods_receipt_id',
        'goods_receipt_line_id',
        'warehouse_id',
        'received_qty',
        'remaining_qty',
        'landed_unit_cost',
        'sale_price_snapshot',
        'receipt_date',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'received_qty' => 'decimal:4',
            'remaining_qty' => 'decimal:4',
            'landed_unit_cost' => 'decimal:4',
            'sale_price_snapshot' => 'decimal:2',
            'receipt_date' => 'date:Y-m-d',
        ];
    }

    /** @return BelongsTo<Company, $this> */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /** @return BelongsTo<Supplier, $this> */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** @return BelongsTo<GoodsReceipt, $this> */
    public function goodsReceipt(): BelongsTo
    {
        return $this->belongsTo(GoodsReceipt::class);
    }

    /** @return BelongsTo<GoodsReceiptLine, $this> */
    public function goodsReceiptLine(): BelongsTo
    {
        return $this->belongsTo(GoodsReceiptLine::class);
    }

    /** @return BelongsTo<Warehouse, $this> */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function costValue(): float
    {
        return round((float) $this->remaining_qty * (float) $this->landed_unit_cost, 2);
    }

    public function saleValue(): float
    {
        return round((float) $this->remaining_qty * (float) ($this->sale_price_snapshot ?? 0), 2);
    }
}
