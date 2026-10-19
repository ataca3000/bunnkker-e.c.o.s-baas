<?php

declare(strict_types=1);

namespace Modules\Finance\Cash\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Finance\Ledger\Domain\Models\Account;

/**
 * A till or petty-cash box, linked 1:1 to a GL cash account. Its balance IS the
 * GL account's balance — never stored here. Every movement posts through the
 * Posting Engine.
 */
class CashAccount extends Model
{
    protected $table = 'finance_cash_accounts';

    /** @var array<string, mixed> */
    protected $attributes = [
        'currency' => 'EGP',
        'is_active' => true,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'branch_id', 'code', 'name',
        'gl_account_id', 'currency', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $account): void {
            if ($account->uuid === null) {
                $account->uuid = (string) Str::uuid();
            }
        });
    }

    public function glAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'gl_account_id');
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(CashSession::class, 'cash_account_id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(CashTransaction::class, 'cash_account_id');
    }
}
