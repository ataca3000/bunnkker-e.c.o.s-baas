<?php

declare(strict_types=1);

namespace Modules\Finance\Banking\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Finance\Ledger\Domain\Models\Account;

/**
 * A real bank account, linked 1:1 to a GL bank account. The book balance is the
 * GL account's balance; the bank's own balance arrives via statements and is
 * reconciled against it. No balance is stored here.
 */
class BankAccount extends Model
{
    protected $table = 'finance_bank_accounts';

    /** @var array<string, mixed> */
    protected $attributes = [
        'currency' => 'EGP',
        'is_active' => true,
    ];

    protected $fillable = [
        'uuid', 'company_id', 'name', 'bank_name', 'account_number', 'iban', 'swift',
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

    public function statements(): HasMany
    {
        return $this->hasMany(BankStatement::class, 'bank_account_id');
    }

    public function reconciliations(): HasMany
    {
        return $this->hasMany(BankReconciliation::class, 'bank_account_id');
    }

    public function rules(): HasMany
    {
        return $this->hasMany(BankReconciliationRule::class, 'bank_account_id');
    }
}
