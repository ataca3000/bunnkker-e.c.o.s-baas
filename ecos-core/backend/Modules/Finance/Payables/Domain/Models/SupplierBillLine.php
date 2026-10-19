<?php

declare(strict_types=1);

namespace Modules\Finance\Payables\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Modules\Finance\Ledger\Domain\Models\Account;
use Modules\Finance\Tax\Domain\Models\TaxCode;

/**
 * One line of a supplier bill — the expense (or asset) it records and the
 * recoverable input tax on it. The posting is assembled from these lines: DR
 * each expense account (net), DR the input-tax account (tax), CR the AP control.
 */
class SupplierBillLine extends Model
{
    protected $table = 'finance_supplier_bill_lines';

    /** @var array<string, mixed> */
    protected $attributes = [
        'quantity' => 1,
        'unit_price' => 0,
        'net_amount' => 0,
        'tax_amount' => 0,
    ];

    protected $fillable = [
        'uuid', 'supplier_bill_id', 'expense_account_id', 'description',
        'quantity', 'unit_price', 'net_amount', 'tax_code_id', 'tax_amount',
        'cost_center_id', 'branch_id',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'unit_price' => 'decimal:4',
            'net_amount' => 'decimal:4',
            'tax_amount' => 'decimal:4',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $line): void {
            if ($line->uuid === null) {
                $line->uuid = (string) Str::uuid();
            }
        });
    }

    public function bill(): BelongsTo
    {
        return $this->belongsTo(SupplierBill::class, 'supplier_bill_id');
    }

    public function expenseAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'expense_account_id');
    }

    public function taxCode(): BelongsTo
    {
        return $this->belongsTo(TaxCode::class, 'tax_code_id');
    }
}
