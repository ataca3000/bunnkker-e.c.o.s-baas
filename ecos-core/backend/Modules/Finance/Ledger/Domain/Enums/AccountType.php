<?php

declare(strict_types=1);

namespace Modules\Finance\Ledger\Domain\Enums;

/**
 * The five fundamental account types.
 *
 * The type fixes two things that must never be inconsistent: the account's
 * normal balance side, and the financial statement it lands on. Everything
 * downstream (trial balance signing, P&L vs balance-sheet classification) is
 * derived from here, so it is the single place these rules live.
 */
enum AccountType: string
{
    case Asset = 'asset';
    case Liability = 'liability';
    case Equity = 'equity';
    case Revenue = 'revenue';
    case Expense = 'expense';

    public function label(): string
    {
        return ucfirst($this->value);
    }

    /** Assets and expenses increase on the debit side; the rest on the credit side. */
    public function normalBalance(): NormalBalance
    {
        return match ($this) {
            self::Asset, self::Expense => NormalBalance::Debit,
            self::Liability, self::Equity, self::Revenue => NormalBalance::Credit,
        };
    }

    /** Which statement the account belongs to. */
    public function statement(): string
    {
        return match ($this) {
            self::Asset, self::Liability, self::Equity => 'balance_sheet',
            self::Revenue, self::Expense => 'income_statement',
        };
    }

    /** P&L accounts close to retained earnings at year-end; balance-sheet accounts roll forward. */
    public function isTemporary(): bool
    {
        return $this->statement() === 'income_statement';
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    /** @return list<array{value: string, label: string, normal_balance: string, statement: string}> */
    public static function options(): array
    {
        return array_map(static fn (self $c) => [
            'value' => $c->value,
            'label' => $c->label(),
            'normal_balance' => $c->normalBalance()->value,
            'statement' => $c->statement(),
        ], self::cases());
    }
}
