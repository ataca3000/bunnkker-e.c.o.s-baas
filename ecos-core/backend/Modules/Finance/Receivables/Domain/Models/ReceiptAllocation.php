<?php

declare(strict_types=1);

namespace Modules\Finance\Receivables\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * An append-only link applying part (or all) of a receipt to one invoice.
 *
 * Many rows per receipt = one receipt settling many invoices; many rows per
 * invoice = one invoice settled by many receipts. Outstanding balances are the
 * SUM of these rows — never a stored figure. Allocations are immutable; an error
 * is undone by a reversing allocation, not an edit.
 */
class ReceiptAllocation extends Model
{
    protected $table = 'finance_receipt_allocations';

    protected $fillable = [
        'uuid', 'company_id', 'receipt_id', 'customer_invoice_id',
        'amount', 'allocated_at', 'allocated_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:4',
            'allocated_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $allocation): void {
            if ($allocation->uuid === null) {
                $allocation->uuid = (string) Str::uuid();
            }
        });

        // Append-only: allocations are never edited or deleted.
        static::updating(static fn (): bool => false);
        static::deleting(static fn (): bool => false);
    }

    public function receipt(): BelongsTo
    {
        return $this->belongsTo(CustomerReceipt::class, 'receipt_id');
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(CustomerInvoice::class, 'customer_invoice_id');
    }
}
