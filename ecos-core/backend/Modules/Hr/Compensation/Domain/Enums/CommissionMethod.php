<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Enums;

/**
 * How a commission rule turns a measured metric into money.
 *
 * ┌─ THE WHOLE COMMISSION ENGINE, IN THREE METHODS ─────────────────────────┐
 * │ A sales representative on 2% of sales and a driver on EGP 15 per delivered │
 * │ shipment differ only in which of these is selected and what rate is set.   │
 * │ There is no per-role calculation anywhere in the codebase.                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
enum CommissionMethod: string
{
    /** rate % of the metric's total VALUE — e.g. 2% of sales amount. */
    case PercentageOfValue = 'percentage_of_value';

    /** rate × the metric's total QUANTITY — e.g. EGP 15 per delivered shipment. */
    case AmountPerUnit = 'amount_per_unit';

    /** Banded rates from the rule's tier table, by achieved value. */
    case Tiered = 'tiered';

    public function label(): string
    {
        return match ($this) {
            self::PercentageOfValue => 'Percentage of Value',
            self::AmountPerUnit => 'Amount per Unit',
            self::Tiered => 'Tiered',
        };
    }

    /** Which side of the fact the method reads. */
    public function reads(): string
    {
        return $this === self::AmountPerUnit ? 'quantity' : 'value';
    }

    public function requiresTiers(): bool
    {
        return $this === self::Tiered;
    }
}
