<?php

declare(strict_types=1);

namespace Modules\Inventory\StockLedger\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Inventory\StockLedger\Domain\Enums\MovementType;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;

/**
 * A single immutable record in the stock movement ledger.
 *
 * @property string $id
 * @property string $warehouse_id
 * @property string $product_id
 * @property MovementType $movement_type
 * @property numeric-string $quantity
 * @property numeric-string $balance_before
 * @property numeric-string $balance_after
 * @property string|null $reference_type
 * @property string|null $reference_id
 * @property \Illuminate\Support\Carbon $movement_date
 * @property string|null $notes
 */
class StockMovement extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'warehouse_id',
        'product_id',
        'movement_type',
        'quantity',
        'balance_before',
        'balance_after',
        'reference_type',
        'reference_id',
        'movement_date',
        'notes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'movement_type' => MovementType::class,
            'quantity' => 'decimal:4',
            'balance_before' => 'decimal:4',
            'balance_after' => 'decimal:4',
            'movement_date' => 'date',
        ];
    }

    /**
     * @return BelongsTo<Warehouse, $this>
     */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
