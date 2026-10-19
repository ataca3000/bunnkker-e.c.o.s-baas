<?php

declare(strict_types=1);

namespace Modules\POS\Pricing\Domain\Enums;

enum PriceSource: string
{
    case RegularPrice = 'regular_price';
    case SalePrice = 'sale_price';
    /** Reserved: price manually entered by an authorised cashier. */
    case Manual = 'manual';

    public function label(): string
    {
        return match ($this) {
            self::RegularPrice => 'Regular Price',
            self::SalePrice => 'Sale Price',
            self::Manual => 'Manual Override',
        };
    }

    /** True when the source is derived from system data, not a human entry. */
    public function isAutomatic(): bool
    {
        return $this !== self::Manual;
    }
}
