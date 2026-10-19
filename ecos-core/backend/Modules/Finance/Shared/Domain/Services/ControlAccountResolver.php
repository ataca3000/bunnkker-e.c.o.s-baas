<?php

declare(strict_types=1);

namespace Modules\Finance\Shared\Domain\Services;

use Modules\Finance\Ledger\Domain\Exceptions\FinanceException;
use Modules\Finance\Ledger\Domain\Models\Account;

/**
 * Resolves the GL control account a subledger posts against.
 *
 * The AR and AP control accounts are the ONLY bridge between a subledger and the
 * ledger: every AR document moves the AR control, every AP document the AP
 * control. A control account is flagged on the chart of accounts
 * (is_control + control_subledger). Resolving it here — once — keeps the wiring
 * in one place and guarantees a subledger can never post against the wrong node.
 */
final class ControlAccountResolver
{
    /** The AR control account for a company (customers owe us). */
    public function receivable(string $companyId): Account
    {
        return $this->resolve($companyId, 'ar');
    }

    /** The AP control account for a company (we owe suppliers). */
    public function payable(string $companyId): Account
    {
        return $this->resolve($companyId, 'ap');
    }

    private function resolve(string $companyId, string $subledger): Account
    {
        $account = Account::query()
            ->where('company_id', $companyId)
            ->where('is_control', true)
            ->where('control_subledger', $subledger)
            ->where('is_active', true)
            ->orderBy('id')
            ->first();

        if ($account === null) {
            throw FinanceException::controlAccountNotConfigured(strtoupper($subledger));
        }

        return $account;
    }
}
