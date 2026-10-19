<?php

declare(strict_types=1);

namespace Modules\POS\Promotion\Domain\Enums;

enum PromotionRewardType: string
{
    case PercentageDiscount = 'percentage_discount';  // % off qualifying amount
    case FixedAmountDiscount = 'fixed_amount_discount'; // fixed monetary reduction
    case FreeItem = 'free_item';             // complimentary product
    case BundlePrice = 'bundle_price';          // fixed price for a group of items

    public function label(): string
    {
        return match ($this) {
            self::PercentageDiscount => 'Percentage Discount',
            self::FixedAmountDiscount => 'Fixed Amount Discount',
            self::FreeItem => 'Free Item',
            self::BundlePrice => 'Bundle Price',
        };
    }

    public function isMonetary(): bool
    {
        return match ($this) {
            self::PercentageDiscount, self::FixedAmountDiscount, self::BundlePrice => true,
            self::FreeItem => false,
        };
    }
}
