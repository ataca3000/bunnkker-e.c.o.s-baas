<?php

declare(strict_types=1);

namespace Modules\Finance\Receivables\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Finance\Ledger\Domain\Models\Account;
use Modules\Finance\Ledger\Domain\Models\JournalEntry;
use Modules\Finance\Shared\Domain\Enums\DocumentStatus;

/**
 * A customer receipt (money in). Posting it: DR the deposit account (cash/bank),
 * CR the AR control account — through the Posting Engine. The amount is then
 * allocated across open invoices; any unallocated remainder is on account
 * (derived from allocations, never stored).
 */
class CustomerReceipt extends Model
{
    private const FROZEN_ONCE_POSTED = [
        'company_id', 'customer_id', 'number', 'receipt_date', 'amount',
        'currency', 'deposit_account_id', 'ar_control_account_id', 'journal_entry_id',
    ];

    protected $table = 'finance_customer_receipts';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => 'draft',
        'currency' => 'EGP',
    ];

    protected $fillable = [
        'uuid', 'company_id', 'customer_id', 'number', 'receipt_date', 'amount',
        'currency', 'deposit_account_id', 'ar_control_account_id', 'journal_entry_id',
        'status', 'description', 'created_by', 'approved_by', 'posted_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => DocumentStatus::class,
            'receipt_date' => 'date',
            'amount' => 'decimal:4',
            'posted_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $receipt): void {
            if ($receipt->uuid === null) {
                $receipt->uuid = (string) Str::uuid();
            }
        });

        static::updating(function (self $receipt): bool {
            if ($receipt->getRawOriginal('status') === DocumentStatus::Posted->value) {
                foreach (self::FROZEN_ONCE_POSTED as $frozen) {
                    if ($receipt->isDirty($frozen)) {
                        return false;
                    }
                }
            }

            return true;
        });

        static::deleting(static fn (self $receipt): bool => $receipt->status === DocumentStatus::Draft);
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(ReceiptAllocation::class, 'receipt_id');
    }

    public function depositAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'deposit_account_id');
    }

    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class, 'journal_entry_id');
    }

    public function isPosted(): bool
    {
        return $this->status === DocumentStatus::Posted;
    }

    /** Σ already allocated from this receipt — derived. */
    public function allocatedAmount(): float
    {
        return round((float) $this->allocations()->sum('amount'), 4);
    }

    /** The on-account remainder available to allocate — derived, never stored. */
    public function unallocatedAmount(): float
    {
        return round((float) $this->amount - $this->allocatedAmount(), 4);
    }
}
