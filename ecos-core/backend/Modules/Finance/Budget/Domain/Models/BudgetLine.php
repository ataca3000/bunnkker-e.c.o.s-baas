<?php

declare(strict_types=1);

namespace Modules\Finance\Budget\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Modules\Finance\Budget\Domain\Enums\BudgetDimension;
use Modules\Finance\Ledger\Domain\Models\Account;

/**
 * One planned amount for an account, optionally scoped to a dimension and a
 * period. Actuals are matched to it at read time — never stored here.
 */
class BudgetLine extends Model
{
    protected $table = 'finance_budget_lines';

    /** @var array<string, mixed> */
    protected $attributes = ['dimension_type' => 'company', 'amount' => 0];

    protected $fillable = [
        'uuid', 'budget_id', 'account_id', 'dimension_type', 'dimension_id',
        'period_number', 'amount', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'dimension_type' => BudgetDimension::class,
            'period_number' => 'integer',
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

    public function budget(): BelongsTo
    {
        return $this->belongsTo(Budget::class, 'budget_id');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'account_id');
    }
}
