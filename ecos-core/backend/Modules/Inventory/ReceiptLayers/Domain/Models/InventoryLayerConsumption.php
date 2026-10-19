<?php

declare(strict_types=1);

namespace Modules\Inventory\ReceiptLayers\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;

/**
 * Immutable FIFO consumption audit record.
 *
 * One row is created per receipt-layer consumed per order line.
 * Never update. Never delete. Append-only.
 *
 * @property string $id
 * @property string|null $order_id
 * @property string|null $order_line_id
 * @property string $inventory_item_id
 * @property string $inventory_receipt_layer_id
 * @property string $product_id
 * @property string $warehouse_id
 * @property string $company_id
 * @property numeric-string $quantity
 * @property numeric-string $unit_cost
 * @property numeric-string $total_cost
 * @property \Illuminate\Support\Carbon $created_at
 */
class InventoryLayerConsumption extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    // Immutable — no updated_at column
    public $timestamps = false;

    public const CREATED_AT = 'created_at';

    /** @var list<string> */
    protected $fillable = [
        'order_id',
        'order_line_id',
        'inventory_item_id',
        'inventory_receipt_layer_id',
        'product_id',
        'warehouse_id',
        'company_id',
        'quantity',
        'unit_cost',
        'total_cost',
        'created_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'unit_cost' => 'decimal:4',
            'total_cost' => 'decimal:4',
            'created_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<InventoryItem, $this> */
    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }

    /** @return BelongsTo<InventoryReceiptLayer, $this> */
    public function receiptLayer(): BelongsTo
    {
        return $this->belongsTo(InventoryReceiptLayer::class, 'inventory_receipt_layer_id');
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

    /** @return BelongsTo<Company, $this> */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
