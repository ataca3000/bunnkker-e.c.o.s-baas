<?php

declare(strict_types=1);

namespace Modules\Purchasing\SupplierInvoices\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceipt;
use Modules\Purchasing\PurchaseMaterials\Domain\Models\PurchaseMaterial;
use Modules\Purchasing\SupplierInvoices\Domain\Enums\SupplierInvoiceStatus;
use Modules\Purchasing\Suppliers\Domain\Models\Supplier;

class SupplierInvoice extends Model
{
    use HasFactory, HasUuids, SoftDeletes;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'invoice_number',
        'supplier_invoice_ref',
        'supplier_id',
        'warehouse_id',
        'company_id',
        'auto_purchase_id',
        'auto_receipt_id',
        'status',
        'invoice_date',
        'due_date',
        'delivery_date',
        'currency',
        'exchange_rate',
        'subtotal',
        'tax_total',
        'freight_amount',
        'additional_costs',
        'discount_amount',
        'grand_total',
        'payment_terms',
        'payment_terms_days',
        'payment_method',
        'notes',
        'internal_notes',
        'posting_log',
        'posting_error',
        'processing_started_at',
        'posted_by',
        'posted_at',
        'created_by',
    ];

    protected $casts = [
        'status' => SupplierInvoiceStatus::class,
        'invoice_date' => 'date',
        'due_date' => 'date',
        'delivery_date' => 'date',
        'exchange_rate' => 'decimal:6',
        'subtotal' => 'decimal:4',
        'tax_total' => 'decimal:4',
        'freight_amount' => 'decimal:4',
        'additional_costs' => 'decimal:4',
        'discount_amount' => 'decimal:4',
        'grand_total' => 'decimal:4',
        'posting_log' => 'array',
        'processing_started_at' => 'datetime',
        'posted_at' => 'datetime',
    ];

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function autoPurchase(): BelongsTo
    {
        return $this->belongsTo(PurchaseMaterial::class, 'auto_purchase_id');
    }

    public function autoReceipt(): BelongsTo
    {
        return $this->belongsTo(GoodsReceipt::class, 'auto_receipt_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(SupplierInvoiceLine::class);
    }

    public function generateInvoiceNumber(): string
    {
        $prefix = 'INV-'.now()->format('Ym').'-';
        $last = static::query()
            ->where('invoice_number', 'like', $prefix.'%')
            ->orderByDesc('invoice_number')
            ->value('invoice_number');

        $seq = $last ? ((int) substr($last, -4)) + 1 : 1;

        return $prefix.str_pad((string) $seq, 4, '0', STR_PAD_LEFT);
    }

    public function recalculateTotals(): void
    {
        $subtotal = $this->lines->sum('line_total');
        $taxTotal = $this->lines->sum('tax_amount');

        $this->subtotal = $subtotal;
        $this->tax_total = $taxTotal;
        $this->grand_total = $subtotal + $taxTotal + $this->freight_amount + $this->additional_costs - $this->discount_amount;
    }
}
