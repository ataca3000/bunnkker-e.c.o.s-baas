<?php

declare(strict_types=1);

namespace Modules\Finance\Integration\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Modules\Finance\Integration\Domain\Enums\PostingResult;
use Modules\Finance\Ledger\Domain\Models\JournalEntry;

/**
 * One append-only record of an attempt to post a business event. The forward
 * index of traceability and the answer to "what did this event do to the
 * ledger, under which rule, when, and by whom" — including the events that
 * correctly did nothing (skipped) and the ones that failed.
 */
class PostingAuditEntry extends Model
{
    protected $table = 'finance_posting_audit';

    protected $fillable = [
        'uuid', 'company_id', 'source_module', 'source_entity_type', 'source_entity_id',
        'event_code', 'source_event_id', 'posting_rule_code', 'journal_entry_id',
        'result', 'error', 'actor_id', 'occurred_at', 'payload',
    ];

    protected function casts(): array
    {
        return [
            'result' => PostingResult::class,
            'occurred_at' => 'datetime',
            'payload' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $entry): void {
            if ($entry->uuid === null) {
                $entry->uuid = (string) Str::uuid();
            }
        });

        // Append-only — the audit trail is never rewritten.
        static::updating(static fn (): bool => false);
        static::deleting(static fn (): bool => false);
    }

    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class, 'journal_entry_id');
    }
}
