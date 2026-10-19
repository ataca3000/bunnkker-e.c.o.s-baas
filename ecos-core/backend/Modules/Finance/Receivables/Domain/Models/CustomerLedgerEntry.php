<?php

declare(strict_types=1);

namespace Modules\Finance\Receivables\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Modules\Finance\Ledger\Domain\Models\JournalEntry;
use Modules\Finance\Receivables\Domain\Enums\CustomerLedgerEntryType;

/**
 * One movement on a customer's account (the AR subledger detail).
 *
 * ┌─ APPEND-ONLY · SIGNED · NO STORED BALANCE ──────────────────────────────┐
 * │ Written once, alongside the GL posting it mirrors, and never changed. A   │
 * │ customer's balance is SUM(amount); the sum across all customers          │
 * │ reconciles to the AR control account in the GL. Corrections are new       │
 * │ entries, never edits.                                                     │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class CustomerLedgerEntry extends Model
{
    protected $table = 'finance_customer_ledger_entries';

    protected $fillable = [
        'uuid', 'company_id', 'customer_id', 'entry_date', 'entry_type',
        'amount', 'source_type', 'source_id', 'journal_entry_id', 'description',
    ];

    protected function casts(): array
    {
        return [
            'entry_type' => CustomerLedgerEntryType::class,
            'entry_date' => 'date',
            'amount' => 'decimal:4',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $entry): void {
            if ($entry->uuid === null) {
                $entry->uuid = (string) Str::uuid();
            }
        });

        // Append-only: an accounting record of the past cannot be rewritten.
        static::updating(static fn (): bool => false);
        static::deleting(static fn (): bool => false);
    }

    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class, 'journal_entry_id');
    }
}
