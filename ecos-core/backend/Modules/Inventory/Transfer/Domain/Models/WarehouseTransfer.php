<?php

declare(strict_types=1);

namespace Modules\Inventory\Transfer\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Inventory\Transfer\Domain\Enums\TransferStatus;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;

/**
 * Immutable audit record created once per successful warehouse transfer.
 *
 * @property string $id
 * @property string $transfer_number
 * @property string $company_id
 * @property string $source_warehouse_id
 * @property string $destination_warehouse_id
 * @property string $product_id
 * @property float $quantity
 * @property float $total_cost
 * @property float $weighted_unit_cost
 * @property TransferStatus $status
 * @property string|null $transferred_by
 * @property \Carbon\Carbon $transferred_at
 * @property string|null $reference
 * @property string|null $notes
 * @property array<string,mixed>|null $meta
 */
class WarehouseTransfer extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'transfer_number',
        'company_id',
        'source_warehouse_id',
        'destination_warehouse_id',
        'product_id',
        'quantity',
        'total_cost',
        'weighted_unit_cost',
        'status',
        'transferred_by',
        'transferred_at',
        'reference',
        'notes',
        'meta',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'quantity' => 'float',
        'total_cost' => 'float',
        'weighted_unit_cost' => 'float',
        'status' => TransferStatus::class,
        'transferred_at' => 'datetime',
        'meta' => 'array',
    ];

    /** @return BelongsTo<Company, $this> */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /** @return BelongsTo<Warehouse, $this> */
    public function sourceWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'source_warehouse_id');
    }

    /** @return BelongsTo<Warehouse, $this> */
    public function destinationWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'destination_warehouse_id');
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
