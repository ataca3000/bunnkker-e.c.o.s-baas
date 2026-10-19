<?php

declare(strict_types=1);

namespace Modules\POS\Discount\Domain\Enums;

enum DiscountScope: string
{
    case LineItem = 'line_item';
    case CartTotal = 'cart_total';

    public function label(): string
    {
        return match ($this) {
            self::LineItem => 'Line Item',
            self::CartTotal => 'Cart Total',
        };
    }
}
