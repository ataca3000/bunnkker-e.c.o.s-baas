<?php

declare(strict_types=1);

namespace Modules\POS\Promotion\Domain\Enums;

enum PromotionConditionType: string
{
    case AnyPurchase = 'any_purchase';       // always satisfied
    case MinimumCartTotal = 'minimum_cart_total'; // cart total >= threshold
    case MinimumQuantity = 'minimum_quantity';   // item count >= threshold (optionally per product)
    case SpecificProduct = 'specific_product';   // cart contains specific product
    case CustomerGroup = 'customer_group';      // customer belongs to group

    public function label(): string
    {
        return match ($this) {
            self::AnyPurchase => 'Any Purchase',
            self::MinimumCartTotal => 'Minimum Cart Total',
            self::MinimumQuantity => 'Minimum Quantity',
            self::SpecificProduct => 'Specific Product',
            self::CustomerGroup => 'Customer Group',
        };
    }

    public function requiresCustomer(): bool
    {
        return $this === self::CustomerGroup;
    }
}
