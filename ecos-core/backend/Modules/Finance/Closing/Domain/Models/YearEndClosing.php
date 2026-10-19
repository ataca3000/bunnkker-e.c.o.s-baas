<?php

declare(strict_types=1);

namespace Modules\Finance\Closing\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Modules\Finance\Closing\Domain\Enums\YearEndStatus;
use Modules\Finance\Fiscal\Domain\Models\FiscalYear;
use Modules\Finance\Ledger\Domain\Models\Account;
use Modules\Finance\Ledger\Domain\Models\JournalEntry;

/**
 * The year-end closing record — the P&L-closing and opening journals it produced,
 * the net income swept to retained earnings, and its lifecycle. Repeatable until
 * finalized; finalized is immutable.
 */
class YearEndClosing extends Model
{
    protected $table = 'finance_year_end_closings';

    /** @var array<string, mixed> */
    protected $attributes = ['status' => 'draft', 'net_income' => 0, 'run_count' => 0];

    protected $fillable = [
        'uuid', 'company_id', 'fiscal_year_id', 'next_fiscal_year_id', 'status',
        'retained_earnings_account_id', 'net_income', 'pnl_closing_journal_id',
        'carry_forward_journal_id', 'opening_journal_id', 'run_count', 'closed_by', 'closed_at', 'finalized_by', 'finalized_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => YearEndStatus::class,
            'net_income' => 'decimal:4',
            'run_count' => 'integer',
            'closed_at' => 'datetime',
            'finalized_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $row): void {
            if ($row->uuid === null) {
                $row->uuid = (string) Str::uuid();
            }
        });

        // A finalized year-end is immutable.
        static::updating(static fn (self $row): bool => $row->getRawOriginal('status') !== YearEndStatus::Finalized->value);
    }

    public function year(): BelongsTo
    {
        return $this->belongsTo(FiscalYear::class, 'fiscal_year_id');
    }

    public function retainedEarnings(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'retained_earnings_account_id');
    }

    public function pnlClosingJournal(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class, 'pnl_closing_journal_id');
    }

    public function openingJournal(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class, 'opening_journal_id');
    }

    public function isFinalized(): bool
    {
        return $this->status === YearEndStatus::Finalized;
    }
}
