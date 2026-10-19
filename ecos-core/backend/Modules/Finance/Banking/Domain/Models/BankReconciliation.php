<?php

declare(strict_types=1);

namespace Modules\Finance\Banking\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * A reconciliation run over one statement: it records the book balance, the
 * statement balance and the difference. It completes only when the difference is
 * fully explained by outstanding (unmatched) items. Once completed it is frozen.
 */
class BankReconciliation extends Model
{
    protected $table = 'finance_bank_reconciliations';

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => 'open',
        'book_balance' => 0,
        'statement_balance' => 0,
        'difference' => 0,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'bank_account_id', 'bank_statement_id',
        'reconciliation_date', 'book_balance', 'statement_balance', 'difference',
        'status', 'completed_at', 'created_by', 'completed_by',
    ];

    protected function casts(): array
    {
        return [
            'reconciliation_date' => 'date',
            'book_balance' => 'decimal:4',
            'statement_balance' => 'decimal:4',
            'difference' => 'decimal:4',
            'completed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $recon): void {
            if ($recon->uuid === null) {
                $recon->uuid = (string) Str::uuid();
            }
        });

        // A completed reconciliation is a signed-off record — immutable.
        static::updating(static fn (self $recon): bool => $recon->getRawOriginal('status') !== 'completed');
        static::deleting(static fn (self $recon): bool => $recon->status !== 'completed');
    }

    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class, 'bank_account_id');
    }

    public function statement(): BelongsTo
    {
        return $this->belongsTo(BankStatement::class, 'bank_statement_id');
    }

    public function matchedLines(): HasMany
    {
        return $this->hasMany(BankStatementLine::class, 'reconciliation_id');
    }

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }
}
