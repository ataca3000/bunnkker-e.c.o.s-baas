<?php

declare(strict_types=1);

namespace Modules\Finance\Cash\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Modules\Finance\Ledger\Domain\Models\Account;
use Modules\Finance\Ledger\Domain\Models\JournalEntry;

/**
 * A single cash movement — receipt, payment, adjustment or transfer leg. Each
 * posts to the GL through the Posting Engine and records the journal here for a
 * complete audit trail. The row itself is immutable once posted; a correction is
 * a reversing transaction.
 */
class CashTransaction extends Model
{
    protected $table = 'finance_cash_transactions';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => 'posted',
    ];

    protected $fillable = [
        'uuid', 'company_id', 'cash_account_id', 'cash_session_id',
        'transaction_type', 'amount', 'transaction_date',
        'counterparty_account_id', 'journal_entry_id', 'description', 'status', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:4',
            'transaction_date' => 'date',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $txn): void {
            if ($txn->uuid === null) {
                $txn->uuid = (string) Str::uuid();
            }
        });

        // Immutable once posted; only voiding (a status change) is permitted, and
        // the financial identity never changes.
        static::updating(function (self $txn): bool {
            if ($txn->getRawOriginal('status') === 'posted') {
                foreach (['company_id', 'cash_account_id', 'transaction_type', 'amount', 'journal_entry_id'] as $frozen) {
                    if ($txn->isDirty($frozen)) {
                        return false;
                    }
                }
            }

            return true;
        });

        static::deleting(static fn (): bool => false);
    }

    public function cashAccount(): BelongsTo
    {
        return $this->belongsTo(CashAccount::class, 'cash_account_id');
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(CashSession::class, 'cash_session_id');
    }

    public function counterpartyAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'counterparty_account_id');
    }

    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class, 'journal_entry_id');
    }
}
