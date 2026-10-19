<?php

declare(strict_types=1);

namespace Modules\Finance\Receivables\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Modules\Finance\Ledger\Domain\Models\Account;
use Modules\Finance\Tax\Domain\Models\TaxCode;

/**
 * One line of a customer invoice — the revenue it recognises and the tax on it.
 * The posting is assembled from these lines: CR each revenue account (net),
 * CR the output-tax account (tax), DR the AR control (total).
 */
class CustomerInvoiceLine extends Model
{
    protected $table = 'finance_customer_invoice_lines';

    /** @var array<string, mixed> */
    protected $attributes = [
        'quantity' => 1,
        'unit_price' => 0,
        'net_amount' => 0,
        'tax_amount' => 0,
    ];

    protected $fillable = [
        'uuid', 'customer_invoice_id', 'revenue_account_id', 'description',
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

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(CustomerInvoice::class, 'customer_invoice_id');
    }

    public function revenueAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'revenue_account_id');
    }

    public function taxCode(): BelongsTo
    {
        return $this->belongsTo(TaxCode::class, 'tax_code_id');
    }
}
