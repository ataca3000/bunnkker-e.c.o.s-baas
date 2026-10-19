<?php

declare(strict_types=1);

namespace Modules\POS\Shared\Domain\Enums;

use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Percentage;

enum DiscountType: string
{
    case Percentage = 'percentage';
    case FixedAmount = 'fixed_amount';

    /**
     * Compute the discount amount given a base price.
     *
     * @param  string  $discountValue  The discount value (percentage 0-100 OR fixed amount).
     */
    public function computeAmount(Money $basePrice, string $discountValue): Money
    {
        return match ($this) {
            self::Percentage => Percentage::of($discountValue)->applyTo($basePrice),
            self::FixedAmount => Money::of($discountValue, $basePrice->currency),
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Percentage => 'Percentage',
            self::FixedAmount => 'Fixed Amount',
        };
    }
}
