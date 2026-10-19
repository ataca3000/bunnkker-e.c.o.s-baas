<?php

declare(strict_types=1);

namespace Modules\Finance\Banking\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * One line of a bank statement. A signed amount (money in positive, out
 * negative) and its match state. When matched it points at the book movement
 * that clears it; unmatched lines are outstanding reconciliation items.
 */
class BankStatementLine extends Model
{
    protected $table = 'finance_bank_statement_lines';

    /** @var array<string, mixed> */
    protected $attributes = [
        'match_status' => 'unmatched',
    ];

    protected $fillable = [
        'uuid', 'company_id', 'bank_statement_id', 'value_date', 'description',
        'external_reference', 'amount', 'match_status', 'matched_source_type',
        'matched_source_id', 'reconciliation_id', 'matched_rule_id',
    ];

    protected function casts(): array
    {
        return [
            'value_date' => 'date',
            'amount' => 'decimal:4',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $line): void {
            if ($line->uuid === null) {
                $line->uuid = (string) Str::uuid();
            }
        });
    }

    public function statement(): BelongsTo
    {
        return $this->belongsTo(BankStatement::class, 'bank_statement_id');
    }

    public function reconciliation(): BelongsTo
    {
        return $this->belongsTo(BankReconciliation::class, 'reconciliation_id');
    }

    public function matchedRule(): BelongsTo
    {
        return $this->belongsTo(BankReconciliationRule::class, 'matched_rule_id');
    }

    public function isMatched(): bool
    {
        return $this->match_status === 'matched';
    }
}
