<?php

declare(strict_types=1);

namespace Modules\Finance\Ledger\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * One line of double-entry — the atom of financial truth.
 *
 * ┌─ IMMUTABLE, APPEND-ONLY ────────────────────────────────────────────────┐
 * │ Written once by the Journal Engine and never updated or deleted. The     │
 * │ model refuses both, so even a bug cannot silently alter a posted figure. │
 * │ A correction is a whole new reversing entry, never an edit here.         │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class JournalLine extends Model
{
    protected $table = 'finance_journal_lines';

    protected $fillable = [
        'uuid', 'journal_entry_id', 'account_id',
        'debit', 'credit', 'description', 'line_number',
        'company_id', 'branch_id', 'cost_center_id',
        'profit_center_id', 'project_id', 'campaign_id',
        'currency',
    ];

    protected function casts(): array
    {
        return [
            'debit' => 'decimal:4',
            'credit' => 'decimal:4',
            'line_number' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $line): void {
            if ($line->uuid === null) {
                $line->uuid = (string) Str::uuid();
            }
        });

        // A journal line's content is never mutated once written. (Deletion is
        // only ever reached by discarding a pre-ledger DRAFT entry, which the
        // Journal Engine controls; a posted entry cannot be deleted, so its
        // lines can never be reached.)
        static::updating(static fn () => false);
    }

    public function entry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class, 'journal_entry_id');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'account_id');
    }

    public function isDebit(): bool
    {
        return (float) $this->debit > 0.0;
    }
}
