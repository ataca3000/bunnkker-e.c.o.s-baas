<?php

declare(strict_types=1);

namespace Modules\Finance\Banking\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * A bank statement for a period, carrying the bank's own opening and closing
 * balance. Its lines are matched against book movements during reconciliation.
 */
class BankStatement extends Model
{
    protected $table = 'finance_bank_statements';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => 'imported',
        'opening_balance' => 0,
        'closing_balance' => 0,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'bank_account_id', 'reference', 'statement_date',
        'period_start', 'period_end', 'opening_balance', 'closing_balance',
        'status', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'statement_date' => 'date',
            'period_start' => 'date',
            'period_end' => 'date',
            'opening_balance' => 'decimal:4',
            'closing_balance' => 'decimal:4',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $statement): void {
            if ($statement->uuid === null) {
                $statement->uuid = (string) Str::uuid();
            }
        });
    }

    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class, 'bank_account_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(BankStatementLine::class, 'bank_statement_id');
    }

    /** Unmatched lines are the outstanding reconciliation items. */
    public function unmatchedLines(): HasMany
    {
        return $this->lines()->where('match_status', 'unmatched');
    }
}
