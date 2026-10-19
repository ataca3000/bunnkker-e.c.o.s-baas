<?php

declare(strict_types=1);

namespace Modules\Purchasing\GoodsReceipts\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Purchasing\GoodsReceipts\Infrastructure\Database\Factories\GoodsReceiptLineFactory;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrderLine;

/**
 * A single line in a goods receipt.
 *
 * @property string $id
 * @property string $goods_receipt_id
 * @property string $purchase_order_line_id
 * @property string $product_id
 * @property string|null $uom_id_snapshot UUID of the product's unit at receipt time (immutable)
 * @property string|null $uom_name_snapshot Unit name at receipt time (immutable)
 * @property string|null $uom_symbol_snapshot Unit symbol at receipt time (immutable)
 * @property numeric-string $ordered_quantity
 * @property numeric-string $received_quantity Legacy field; new code uses net_received_quantity
 * @property numeric-string|null $gross_received_quantity
 * @property numeric-string|null $net_received_quantity Authoritative quantity used for stock movements
 * @property numeric-string|null $variance_quantity net - ordered
 * @property numeric-string $unit_price
 * @property numeric-string|null $landed_unit_cost Computed on post
 * @property string|null $weight_photo_path
 * @property string|null $notes
 */
class GoodsReceiptLine extends Model
{
    /** @use HasFactory<GoodsReceiptLineFactory> */
    use HasFactory, HasUuids;

    protected static function newFactory(): GoodsReceiptLineFactory
    {
        return GoodsReceiptLineFactory::new();
    }

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'goods_receipt_id',
        'purchase_order_line_id',
        'product_id',
        'uom_id_snapshot',
        'uom_name_snapshot',
        'uom_symbol_snapshot',
        'ordered_quantity',
        'received_quantity',
        'gross_received_quantity',
        'net_received_quantity',
        'variance_quantity',
        'unit_price',
        'landed_unit_cost',
        'weight_photo_path',
        'notes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'ordered_quantity' => 'decimal:4',
            'received_quantity' => 'decimal:4',
            'gross_received_quantity' => 'decimal:4',
            'net_received_quantity' => 'decimal:4',
            'variance_quantity' => 'decimal:4',
            'unit_price' => 'decimal:2',
            'landed_unit_cost' => 'decimal:4',
        ];
    }

    public function effectiveReceivedQty(): float
    {
        return (float) ($this->net_received_quantity ?? $this->received_quantity ?? 0);
    }

    /**
     * @return BelongsTo<GoodsReceipt, $this>
     */
    public function goodsReceipt(): BelongsTo
    {
        return $this->belongsTo(GoodsReceipt::class);
    }

    /**
     * @return BelongsTo<PurchaseOrderLine, $this>
     */
    public function purchaseOrderLine(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrderLine::class);
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
