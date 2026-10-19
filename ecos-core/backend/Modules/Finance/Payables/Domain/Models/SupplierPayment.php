<?php

declare(strict_types=1);

namespace Modules\Finance\Payables\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Finance\Ledger\Domain\Models\Account;
use Modules\Finance\Ledger\Domain\Models\JournalEntry;
use Modules\Finance\Payables\Domain\Enums\PaymentStatus;

/**
 * A supplier payment (money out). Posting it: DR the AP control account, CR the
 * funding account (cash/bank) — through the Posting Engine.
 *
 * Money leaving the business is a two-person decision: the maker creates the
 * draft, a different checker approves it, and only an approved payment may post.
 */
class SupplierPayment extends Model
{
    private const FROZEN_ONCE_POSTED = [
        'company_id', 'supplier_id', 'number', 'payment_date', 'amount',
        'currency', 'funding_account_id', 'ap_control_account_id', 'journal_entry_id',
    ];

    protected $table = 'finance_supplier_payments';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => 'draft',
        'currency' => 'EGP',
    ];

    protected $fillable = [
        'uuid', 'company_id', 'supplier_id', 'number', 'payment_date', 'amount',
        'currency', 'funding_account_id', 'ap_control_account_id', 'journal_entry_id',
        'status', 'description', 'created_by', 'approved_by', 'approved_at', 'posted_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => PaymentStatus::class,
            'payment_date' => 'date',
            'amount' => 'decimal:4',
            'approved_at' => 'datetime',
            'posted_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $payment): void {
            if ($payment->uuid === null) {
                $payment->uuid = (string) Str::uuid();
            }
        });

        static::updating(function (self $payment): bool {
            if ($payment->getRawOriginal('status') === PaymentStatus::Posted->value) {
                foreach (self::FROZEN_ONCE_POSTED as $frozen) {
                    if ($payment->isDirty($frozen)) {
                        return false;
                    }
                }
            }

            return true;
        });

        static::deleting(static fn (self $payment): bool => $payment->status === PaymentStatus::Draft);
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(PaymentAllocation::class, 'payment_id');
    }

    public function fundingAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'funding_account_id');
    }

    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class, 'journal_entry_id');
    }

    public function isApproved(): bool
    {
        return $this->status === PaymentStatus::Approved;
    }

    public function isPosted(): bool
    {
        return $this->status === PaymentStatus::Posted;
    }

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
