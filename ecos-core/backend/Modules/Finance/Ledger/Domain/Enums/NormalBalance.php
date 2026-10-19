<?php

declare(strict_types=1);

namespace Modules\Finance\Ledger\Domain\Enums;

/**
 * The side on which an account's balance is normally positive.
 *
 * Used to sign a running total into a trial-balance figure: a debit-normal
 * account's balance is (debits − credits); a credit-normal account's is
 * (credits − debits).
 */
enum NormalBalance: string
{
    case Debit = 'debit';
    case Credit = 'credit';

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
