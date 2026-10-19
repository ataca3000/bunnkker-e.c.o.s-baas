<?php

declare(strict_types=1);

namespace Modules\Finance\Ledger\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Finance\Ledger\Domain\Enums\AccountCategory;
use Modules\Finance\Ledger\Domain\Enums\AccountType;
use Modules\Finance\Ledger\Domain\Enums\NormalBalance;

/**
 * A Chart of Accounts node.
 *
 * The type fixes the normal balance side (kept in sync on write). A parent is a
 * rollup and is never postable; a control account is the GL side of a subledger
 * and, from F3, is moved only by that subledger's postings.
 */
class Account extends Model
{
    protected $table = 'finance_accounts';

    /** @var array<string, mixed> */
    protected $attributes = [
        'is_postable' => true,
        'is_control' => false,
        'is_active' => true,
        'currency' => 'EGP',
    ];

    protected $fillable = [
        'uuid', 'company_id', 'code', 'name', 'name_ar',
        'account_type', 'account_category', 'normal_balance', 'parent_id',
        'is_postable', 'is_control', 'control_subledger',
        'currency', 'is_active', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'account_type' => AccountType::class,
            'account_category' => AccountCategory::class,
            'normal_balance' => NormalBalance::class,
            'is_postable' => 'boolean',
            'is_control' => 'boolean',
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

        // The normal balance is DERIVED from the type — never set independently,
        // so the two can never disagree.
        static::saving(function (self $account): void {
            if ($account->account_type instanceof AccountType) {
                $account->normal_balance = $account->account_type->normalBalance()->value;
            }
        });
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    /** A line may reference this account only if it is postable and active. */
    public function canReceivePostings(): bool
    {
        return $this->is_postable && $this->is_active;
    }
}
