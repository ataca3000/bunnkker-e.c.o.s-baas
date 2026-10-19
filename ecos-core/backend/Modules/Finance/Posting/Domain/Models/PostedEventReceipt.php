<?php

declare(strict_types=1);

namespace Modules\Finance\Posting\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Modules\Finance\Ledger\Domain\Models\JournalEntry;

/**
 * Proof that a given source event has already been posted — the idempotency
 * record. Append-only: a receipt is written once and never changed.
 */
class PostedEventReceipt extends Model
{
    protected $table = 'finance_posted_event_receipts';

    protected $fillable = [
        'uuid', 'company_id', 'source_module', 'source_event_id',
        'posting_rule_code', 'journal_entry_id', 'posted_at',
    ];

    protected function casts(): array
    {
        return ['posted_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::creating(function (self $receipt): void {
            if ($receipt->uuid === null) {
                $receipt->uuid = (string) Str::uuid();
            }

            if ($receipt->posted_at === null) {
                $receipt->posted_at = now();
            }
        });

        static::updating(static fn () => false);
        static::deleting(static fn () => false);
    }

    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class, 'journal_entry_id');
    }
}
