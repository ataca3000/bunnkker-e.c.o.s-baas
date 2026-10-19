<?php

declare(strict_types=1);

namespace Modules\Finance\Ledger\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Finance\Fiscal\Domain\Models\FiscalPeriod;
use Modules\Finance\Ledger\Domain\Enums\JournalStatus;
use Modules\Finance\Ledger\Domain\Enums\JournalType;

/**
 * A journal entry — the header of one balanced financial fact.
 *
 * ┌─ WRITTEN ONLY BY THE JOURNAL ENGINE · APPEND-ONLY · IMMUTABLE ───────────┐
 * │ Never deleted. Once posted, its financial identity (date, period,        │
 * │ company, origin) is frozen; only the one-way lifecycle metadata          │
 * │ (status, poster, and the reversal linkage) may change, and only the      │
 * │ engine does that. The amounts live on immutable lines, so the entry is   │
 * │ immutable in every sense that matters.                                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class JournalEntry extends Model
{
    /** Fields frozen the moment an entry is posted. */
    private const FROZEN_ONCE_POSTED = [
        'company_id', 'fiscal_period_id', 'entry_date',
        'source', 'source_module', 'source_event_id',
    ];

    protected $table = 'finance_journal_entries';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => JournalStatus::Draft->value,
        'source' => 'manual',
        'journal_type' => JournalType::General->value,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'fiscal_period_id', 'entry_date',
        'reference', 'description', 'source', 'journal_type', 'source_module', 'source_event_id',
        'status', 'reverses_journal_id', 'reversed_by_journal_id', 'reversal_reason',
        'created_by', 'approved_by', 'posted_at', 'posted_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => JournalStatus::class,
            'journal_type' => JournalType::class,
            'entry_date' => 'date',
            'posted_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $entry): void {
            if ($entry->uuid === null) {
                $entry->uuid = (string) Str::uuid();
            }
        });

        // Immutability: a posted entry's financial identity can never change,
        // and no entry is ever deleted.
        static::updating(function (self $entry): bool {
            // Raw value — getOriginal applies the enum cast, which would not
            // match the string comparison below.
            $originalStatus = $entry->getRawOriginal('status');

            if (in_array($originalStatus, [JournalStatus::Posted->value, JournalStatus::Reversed->value], true)) {
                foreach (self::FROZEN_ONCE_POSTED as $frozen) {
                    if ($entry->isDirty($frozen)) {
                        return false; // refuse — a posted entry's identity is frozen
                    }
                }
            }

            return true;
        });

        // Only a pre-ledger draft may be discarded. A posted or reversed entry
        // is permanent — corrections are reversing entries, never deletions.
        static::deleting(static fn (self $entry): bool => $entry->status === JournalStatus::Draft);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(JournalLine::class, 'journal_entry_id');
    }

    public function period(): BelongsTo
    {
        return $this->belongsTo(FiscalPeriod::class, 'fiscal_period_id');
    }

    public function reverses(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reverses_journal_id');
    }

    public function reversedBy(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reversed_by_journal_id');
    }

    public function isPosted(): bool
    {
        return $this->status === JournalStatus::Posted;
    }

    public function isReversed(): bool
    {
        return $this->status === JournalStatus::Reversed;
    }

    /** Σ of the debit column — equal to the credit total by construction. */
    public function totalDebit(): string
    {
        return (string) $this->lines->sum('debit');
    }

    public function totalCredit(): string
    {
        return (string) $this->lines->sum('credit');
    }
}
