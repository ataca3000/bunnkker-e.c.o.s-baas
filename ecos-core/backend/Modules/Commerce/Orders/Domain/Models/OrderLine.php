<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Commerce\Orders\Domain\Enums\OrderLineManufacturingState;
use Modules\Inventory\Products\Domain\Models\Product;

/**
 * A single line on a commerce order.
 *
 * @property string $id
 * @property string $order_id
 * @property string $product_id
 * @property float $quantity
 * @property float $unit_price
 * @property float $line_total
 * @property OrderLineManufacturingState|null $manufacturing_state
 * @property array|null $manufacturing_result
 * @property \Illuminate\Support\Carbon|null $manufacturing_started_at
 * @property \Illuminate\Support\Carbon|null $manufacturing_completed_at
 */
class OrderLine extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'order_id',
        'product_id',
        'quantity',
        'unit_price',
        'line_total',
        'manufacturing_state',
        'manufacturing_result',
        'manufacturing_started_at',
        'manufacturing_completed_at',
        'reserved_qty',
        'available_qty',
        'prepared_qty',
        'packed_qty',
        'loaded_qty',
        'delivered_qty',
        'returned_qty',
        'cancelled_qty',
        'warehouse_name',
        'batch_number',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'float',
            'unit_price' => 'float',
            'line_total' => 'float',
            'manufacturing_state' => OrderLineManufacturingState::class,
            'manufacturing_result' => 'array',
            'manufacturing_started_at' => 'datetime',
            'manufacturing_completed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Order, $this>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
