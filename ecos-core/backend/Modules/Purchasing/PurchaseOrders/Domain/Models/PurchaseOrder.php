<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseOrders\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceipt;
use Modules\Purchasing\PurchaseOrders\Domain\Enums\PurchaseOrderStatus;
use Modules\Purchasing\PurchaseOrders\Infrastructure\Database\Factories\PurchaseOrderFactory;
use Modules\Purchasing\Suppliers\Domain\Models\Supplier;

/**
 * Purchase Order aggregate root.
 *
 * @property string $id
 * @property string $po_number
 * @property string|null $company_id
 * @property string|null $warehouse_id
 * @property string $supplier_id
 * @property string|null $supplier_reference
 * @property \Illuminate\Support\Carbon $order_date
 * @property \Illuminate\Support\Carbon|null $expected_date
 * @property PurchaseOrderStatus $status
 * @property string|null $notes
 * @property numeric-string $subtotal
 * @property numeric-string $discount_amount
 * @property numeric-string $shipping_amount
 * @property numeric-string $additional_costs
 * @property numeric-string $grand_total
 * @property numeric-string $total
 * @property string|null $approved_by
 * @property \Illuminate\Support\Carbon|null $approved_at
 * @property string|null $created_by
 * @property string|null $updated_by
 */
class PurchaseOrder extends Model
{
    /** @use HasFactory<PurchaseOrderFactory> */
    use HasFactory, HasUuids, SoftDeletes;

    protected static function newFactory(): PurchaseOrderFactory
    {
        return PurchaseOrderFactory::new();
    }

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'po_number',
        'company_id',
        'warehouse_id',
        'supplier_id',
        'supplier_reference',
        'order_date',
        'expected_date',
        'status',
        'notes',
        'subtotal',
        'discount_amount',
        'shipping_amount',
        'additional_costs',
        'grand_total',
        'total',
        'approved_by',
        'approved_at',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => PurchaseOrderStatus::class,
            'order_date' => 'date',
            'expected_date' => 'date',
            'approved_at' => 'datetime',
            'subtotal' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'shipping_amount' => 'decimal:2',
            'additional_costs' => 'decimal:2',
            'grand_total' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }

    /** @return BelongsTo<Company, $this> */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /** @return BelongsTo<Warehouse, $this> */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    /** @return BelongsTo<Supplier, $this> */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    /** @return HasMany<PurchaseOrderLine, $this> */
    public function lines(): HasMany
    {
        return $this->hasMany(PurchaseOrderLine::class);
    }

    /** @return HasMany<GoodsReceipt, $this> */
    public function goodsReceipts(): HasMany
    {
        return $this->hasMany(GoodsReceipt::class);
    }
}
