<?php

declare(strict_types=1);

namespace Modules\Purchasing\SupplierReturns\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceipt;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrder;
use Modules\Purchasing\SupplierReturns\Domain\Enums\SupplierReturnStatus;
use Modules\Purchasing\Suppliers\Domain\Models\Supplier;

class SupplierReturn extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'return_number',
        'supplier_id',
        'warehouse_id',
        'company_id',
        'purchase_order_id',
        'goods_receipt_id',
        'status',
        'reason',
        'quality_condition',
        'return_date',
        'expected_credit_date',
        'notes',
        'internal_notes',
        'total_return_value',
        'credit_method',
        'credit_amount',
        'debit_note_number',
        'credit_received_date',
        'inventory_restocked',
        'inventory_restocked_at',
        'submitted_by',
        'submitted_at',
        'approved_by',
        'approved_at',
        'rejection_reason',
        'completed_by',
        'completed_at',
    ];

    protected $casts = [
        'status' => SupplierReturnStatus::class,
        'return_date' => 'date',
        'expected_credit_date' => 'date',
        'credit_received_date' => 'date',
        'total_return_value' => 'decimal:4',
        'credit_amount' => 'decimal:4',
        'inventory_restocked' => 'boolean',
        'inventory_restocked_at' => 'datetime',
        'submitted_at' => 'datetime',
        'approved_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function goodsReceipt(): BelongsTo
    {
        return $this->belongsTo(GoodsReceipt::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(SupplierReturnLine::class);
    }

    public function generateReturnNumber(): string
    {
        $prefix = 'SR-'.now()->format('Ym').'-';
        $last = static::query()
            ->where('return_number', 'like', $prefix.'%')
            ->orderByDesc('return_number')
            ->value('return_number');

        $seq = $last ? ((int) substr($last, -4)) + 1 : 1;

        return $prefix.str_pad((string) $seq, 4, '0', STR_PAD_LEFT);
    }
}
