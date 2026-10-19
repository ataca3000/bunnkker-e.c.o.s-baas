<?php

declare(strict_types=1);

namespace Modules\Purchasing\GoodsReceipts\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Purchasing\GoodsReceipts\Domain\Enums\GoodsReceiptStatus;
use Modules\Purchasing\GoodsReceipts\Domain\Enums\PaymentMethod;
use Modules\Purchasing\GoodsReceipts\Domain\Enums\PaymentStatus;
use Modules\Purchasing\GoodsReceipts\Infrastructure\Database\Factories\GoodsReceiptFactory;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrder;

/**
 * Goods Receipt header.
 *
 * @property string $id
 * @property string $receipt_number
 * @property string $purchase_order_id
 * @property string $warehouse_id
 * @property \Illuminate\Support\Carbon $receipt_date
 * @property GoodsReceiptStatus $status
 * @property string|null $notes
 * @property string|null $supplier_invoice_number
 * @property \Illuminate\Support\Carbon|null $supplier_invoice_date
 * @property string|null $invoice_attachment_path
 * @property numeric-string $invoice_total_amount
 * @property numeric-string $paid_amount
 * @property numeric-string $freight_amount
 * @property numeric-string $tax_amount
 * @property numeric-string $additional_costs
 * @property PaymentStatus $payment_status
 * @property PaymentMethod|null $payment_method
 * @property int|null $payment_terms_days
 * @property \Illuminate\Support\Carbon|null $payment_due_date
 * @property string|null $posted_by
 * @property \Illuminate\Support\Carbon|null $posted_at
 */
class GoodsReceipt extends Model
{
    /** @use HasFactory<GoodsReceiptFactory> */
    use HasFactory, HasUuids, SoftDeletes;

    public $incrementing = false;

    protected static function newFactory(): GoodsReceiptFactory
    {
        return GoodsReceiptFactory::new();
    }

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'receipt_number',
        'purchase_order_id',
        'company_id',
        'warehouse_id',
        'receipt_date',
        'status',
        'notes',
        // Supplier invoice
        'supplier_invoice_number',
        'supplier_invoice_date',
        'invoice_attachment_path',
        // Invoice financials
        'invoice_total_amount',
        'paid_amount',
        'freight_amount',
        'tax_amount',
        'additional_costs',
        // Payment tracking (for future AP integration)
        'payment_status',
        'payment_method',
        'payment_terms_days',
        'payment_due_date',
        // Posting
        'posted_by',
        'posted_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => GoodsReceiptStatus::class,
            'receipt_date' => 'date',
            'supplier_invoice_date' => 'date',
            'payment_due_date' => 'date',
            'posted_at' => 'datetime',
            'invoice_total_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'freight_amount' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'additional_costs' => 'decimal:2',
            'payment_status' => PaymentStatus::class,
            'payment_method' => PaymentMethod::class,
            'payment_terms_days' => 'integer',
        ];
    }

    /** invoice_total_amount − paid_amount. Always >= 0. */
    public function outstandingAmount(): float
    {
        return max(0.0, (float) $this->invoice_total_amount - (float) $this->paid_amount);
    }

    /** Derive payment_status from paid_amount vs invoice_total_amount. */
    public static function derivePaymentStatus(float $paidAmount, float $invoiceTotal): string
    {
        if ($paidAmount <= 0) {
            return PaymentStatus::Unpaid->value;
        }
        if ($invoiceTotal > 0 && $paidAmount >= $invoiceTotal) {
            return PaymentStatus::Paid->value;
        }

        return PaymentStatus::PartiallyPaid->value;
    }

    /** Sum of freight + tax + additional — used for per-unit landed cost distribution at post time. */
    public function totalLandedCosts(): float
    {
        return (float) $this->freight_amount
            + (float) $this->tax_amount
            + (float) $this->additional_costs;
    }

    /** @return BelongsTo<PurchaseOrder, $this> */
    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    /** @return BelongsTo<Warehouse, $this> */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    /** @return HasMany<GoodsReceiptLine, $this> */
    public function lines(): HasMany
    {
        return $this->hasMany(GoodsReceiptLine::class);
    }
}
