<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryItems\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Inventory\InventoryItems\Domain\Enums\LedgerMovementType;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;

/**
 * Immutable, append-only record in the stock ledger.
 *
 * Never update or delete rows in this table. The full sequence of entries
 * for an InventoryItem is the authoritative audit trail from which the
 * current stock state can always be reconstructed.
 *
 * @property string $id
 * @property string $inventory_item_id
 * @property string $warehouse_id
 * @property string $product_id
 * @property string $company_id
 * @property LedgerMovementType $movement_type
 * @property numeric-string $quantity
 * @property numeric-string $on_hand_before
 * @property numeric-string $on_hand_after
 * @property numeric-string $reserved_before
 * @property numeric-string $reserved_after
 * @property string|null $reference_type
 * @property string|null $reference_id
 * @property string|null $notes
 * @property \Illuminate\Support\Carbon $created_at
 */
class StockLedgerEntry extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    // Immutable — no updated_at column.
    public const UPDATED_AT = null;

    /** @var list<string> */
    protected $fillable = [
        'inventory_item_id',
        'warehouse_id',
        'product_id',
        'company_id',
        'movement_type',
        'quantity',
        'on_hand_before',
        'on_hand_after',
        'reserved_before',
        'reserved_after',
        'reference_type',
        'reference_id',
        'notes',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'movement_type' => LedgerMovementType::class,
            'quantity' => 'decimal:4',
            'on_hand_before' => 'decimal:4',
            'on_hand_after' => 'decimal:4',
            'reserved_before' => 'decimal:4',
            'reserved_after' => 'decimal:4',
        ];
    }

    /** @return BelongsTo<InventoryItem, $this> */
    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }

    /** @return BelongsTo<Warehouse, $this> */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** @return BelongsTo<Company, $this> */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
