<?php

declare(strict_types=1);

namespace Modules\Finance\Ledger\Domain\Enums;

/**
 * A finer classification within an account type — the grouping a financial
 * statement lays accounts out by (Current vs Non-current Asset, Cost of Sales
 * vs Operating Expense, …).
 *
 * ┌─ A CLASSIFICATION, NOT A NEW AXIS ──────────────────────────────────────┐
 * │ Category refines the TYPE; it never contradicts it. Each category names  │
 * │ its parent type, so the two can be validated for consistency. It does    │
 * │ NOT explode the chart of accounts and it is NOT a posting dimension —    │
 * │ dimensions (company, branch, cost centre) live on the journal line.      │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
enum AccountCategory: string
{
    case CurrentAsset = 'current_asset';
    case NonCurrentAsset = 'non_current_asset';
    case CurrentLiability = 'current_liability';
    case NonCurrentLiability = 'non_current_liability';
    case Equity = 'equity';
    case OperatingRevenue = 'operating_revenue';
    case OtherRevenue = 'other_revenue';
    case CostOfSales = 'cost_of_sales';
    case OperatingExpense = 'operating_expense';
    case OtherExpense = 'other_expense';

    public function label(): string
    {
        return ucwords(str_replace('_', ' ', $this->value));
    }

    /** The account type this category must belong to. */
    public function type(): AccountType
    {
        return match ($this) {
            self::CurrentAsset, self::NonCurrentAsset => AccountType::Asset,
            self::CurrentLiability, self::NonCurrentLiability => AccountType::Liability,
            self::Equity => AccountType::Equity,
            self::OperatingRevenue, self::OtherRevenue => AccountType::Revenue,
            self::CostOfSales, self::OperatingExpense, self::OtherExpense => AccountType::Expense,
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    /** @return list<array{value: string, label: string, type: string}> */
    public static function options(): array
    {
        return array_map(static fn (self $c) => [
            'value' => $c->value,
            'label' => $c->label(),
            'type' => $c->type()->value,
        ], self::cases());
    }
}
