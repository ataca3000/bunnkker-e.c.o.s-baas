<?php

declare(strict_types=1);

namespace Modules\Finance\Ledger\Domain\Services;

use Modules\Finance\Ledger\Domain\Enums\AccountCategory;
use Modules\Finance\Ledger\Domain\Enums\AccountType;
use Modules\Finance\Ledger\Domain\Exceptions\FinanceException;
use Modules\Finance\Ledger\Domain\Models\Account;

/**
 * The Chart of Accounts — the only writer of finance_accounts.
 *
 * Normal balance is never set by a caller; it is derived from the account type
 * on save (in the model), so the taxonomy can never contradict itself.
 */
class ChartOfAccountsService
{
    /** @param array<string, mixed> $attributes */
    public function create(array $attributes, ?int $actorId = null): Account
    {
        $account = new Account($attributes);
        $account->account_type = $attributes['account_type'] instanceof AccountType
            ? $attributes['account_type']
            : AccountType::from((string) $attributes['account_type']);

        // A category must belong to the account's type — it refines the type,
        // it never contradicts it.
        if (! empty($attributes['account_category'])) {
            $category = $attributes['account_category'] instanceof AccountCategory
                ? $attributes['account_category']
                : AccountCategory::from((string) $attributes['account_category']);

            if ($category->type() !== $account->account_type) {
                throw new FinanceException(
                    "Category {$category->label()} belongs to {$category->type()->label()}, not {$account->account_type->label()}."
                );
            }
        }
        // A rollup (parent) account is never postable.
        if (! empty($attributes['is_control'])) {
            $account->is_postable = $attributes['is_postable'] ?? true;
        }
        $account->created_by = $actorId;
        $account->save();

        return $account->refresh();
    }

    /** @param array<string, mixed> $attributes */
    public function update(Account $account, array $attributes): Account
    {
        // Type may change only while the account has never been posted to; the
        // controller enforces that guard. Here we simply apply and let the model
        // re-derive the normal balance.
        $account->fill($attributes);
        $account->save();

        return $account->refresh();
    }
}
