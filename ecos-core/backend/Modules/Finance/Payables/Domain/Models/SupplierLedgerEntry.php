<?php

declare(strict_types=1);

namespace Modules\Finance\Payables\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Modules\Finance\Ledger\Domain\Models\JournalEntry;
use Modules\Finance\Payables\Domain\Enums\SupplierLedgerEntryType;

/**
 * One movement on a supplier's account (the AP subledger detail). The mirror of
 * the customer ledger: append-only, signed, no stored balance. A supplier's
 * balance is SUM(amount); the sum across all suppliers reconciles to the AP
 * control account in the GL.
 */
class SupplierLedgerEntry extends Model
{
    protected $table = 'finance_supplier_ledger_entries';

    protected $fillable = [
        'uuid', 'company_id', 'supplier_id', 'entry_date', 'entry_type',
        'amount', 'source_type', 'source_id', 'journal_entry_id', 'description',
    ];

    protected function casts(): array
    {
        return [
            'entry_type' => SupplierLedgerEntryType::class,
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

        static::updating(static fn (): bool => false);
        static::deleting(static fn (): bool => false);
    }

    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class, 'journal_entry_id');
    }
}
