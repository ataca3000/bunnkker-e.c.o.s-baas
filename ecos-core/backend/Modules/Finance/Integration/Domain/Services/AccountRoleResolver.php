<?php

declare(strict_types=1);

namespace Modules\Finance\Integration\Domain\Services;

use Modules\Finance\Integration\Domain\Models\AccountRole;
use Modules\Finance\Ledger\Domain\Exceptions\FinanceException;

/**
 * Resolves a posting ROLE to a company's GL account id.
 *
 * This is the sole place a role name becomes an account. Because posting rules
 * are shared, hardcoded-free templates, ALL account selection funnels through
 * here — and an unmapped role fails loudly with an actionable message rather
 * than guessing an account. Cached per request to keep hot posting streams fast.
 *
 * @internal read-only resolver; it never writes.
 */
final class AccountRoleResolver
{
    /** @var array<string, int> company|role → account_id */
    private array $cache = [];

    public function resolve(string $companyId, string $role): int
    {
        $key = $companyId.'|'.$role;

        if (isset($this->cache[$key])) {
            return $this->cache[$key];
        }

        $mapping = AccountRole::query()
            ->where('company_id', $companyId)
            ->where('role', $role)
            ->first();

        if ($mapping === null) {
            throw FinanceException::accountRoleNotMapped($role, $companyId);
        }

        return $this->cache[$key] = (int) $mapping->account_id;
    }

    public function isMapped(string $companyId, string $role): bool
    {
        return AccountRole::query()
            ->where('company_id', $companyId)
            ->where('role', $role)
            ->exists();
    }
}
