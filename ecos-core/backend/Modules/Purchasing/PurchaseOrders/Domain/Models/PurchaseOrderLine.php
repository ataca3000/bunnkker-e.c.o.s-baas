<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseOrders\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Purchasing\PurchaseOrders\Infrastructure\Database\Factories\PurchaseOrderLineFactory;

/**
 * A single line in a purchase order.
 *
 * @property string $id
 * @property string $purchase_order_id
 * @property string $product_id
 * @property string|null $description
 * @property numeric-string $quantity Ordered quantity (alias: ordered_qty)
 * @property numeric-string $received_qty Cumulative received across all posted GRs
 * @property numeric-string $unit_price
 * @property numeric-string $line_total
 */
class PurchaseOrderLine extends Model
{
    /** @use HasFactory<PurchaseOrderLineFactory> */
    use HasFactory, HasUuids;

    public $incrementing = false;

    protected static function newFactory(): PurchaseOrderLineFactory
    {
        return PurchaseOrderLineFactory::new();
    }

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'purchase_order_id',
        'product_id',
        'description',
        'quantity',
        'received_qty',
        'unit_price',
        'line_total',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'received_qty' => 'decimal:4',
            'unit_price' => 'decimal:2',
            'line_total' => 'decimal:2',
        ];
    }

    public function remainingQty(): float
    {
        return max(0.0, (float) $this->quantity - (float) $this->received_qty);
    }

    public function isFullyReceived(): bool
    {
        return (float) $this->received_qty >= (float) $this->quantity;
    }

    /** @return BelongsTo<PurchaseOrder, $this> */
    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
