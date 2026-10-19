<?php

declare(strict_types=1);

namespace Modules\Finance\Payables\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * An append-only link applying part (or all) of a payment to one bill. The AP
 * mirror of the receipt allocation: partial, full and multiple-bill matching;
 * outstanding is the SUM of these rows, never stored; immutable once written.
 */
class PaymentAllocation extends Model
{
    protected $table = 'finance_payment_allocations';

    protected $fillable = [
        'uuid', 'company_id', 'payment_id', 'supplier_bill_id',
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

        static::updating(static fn (): bool => false);
        static::deleting(static fn (): bool => false);
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(SupplierPayment::class, 'payment_id');
    }

    public function bill(): BelongsTo
    {
        return $this->belongsTo(SupplierBill::class, 'supplier_bill_id');
    }
}
