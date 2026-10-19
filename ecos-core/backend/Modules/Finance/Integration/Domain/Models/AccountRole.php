<?php

declare(strict_types=1);

namespace Modules\Finance\Integration\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Modules\Finance\Ledger\Domain\Models\Account;

/**
 * A company's mapping of a posting ROLE to a real GL account. The configuration
 * that lets shared, hardcoded-free posting rules resolve to this company's own
 * chart of accounts.
 */
class AccountRole extends Model
{
    protected $table = 'finance_account_roles';

    protected $fillable = [
        'uuid', 'company_id', 'role', 'account_id', 'description',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $role): void {
            if ($role->uuid === null) {
                $role->uuid = (string) Str::uuid();
            }
        });
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'account_id');
    }
}
