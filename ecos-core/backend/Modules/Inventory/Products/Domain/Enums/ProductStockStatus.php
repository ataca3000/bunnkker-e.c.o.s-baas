<?php

declare(strict_types=1);

namespace Modules\Inventory\Products\Domain\Enums;

enum ProductStockStatus: string
{
    case InStock = 'instock';
    case OutOfStock = 'outofstock';
    case OnBackorder = 'onbackorder';

    public function label(): string
    {
        return match ($this) {
            self::InStock => 'In Stock',
            self::OutOfStock => 'Out of Stock',
            self::OnBackorder => 'On Backorder',
        };
    }
}
