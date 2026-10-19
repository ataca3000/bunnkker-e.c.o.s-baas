<?php

declare(strict_types=1);

namespace Modules\Commerce\Channels\Domain\Enums;

enum ChannelPlatform: string
{
    case WooCommerce = 'woocommerce';
    case Shopify = 'shopify';
    case Amazon = 'amazon';
    case Noon = 'noon';
    case Salla = 'salla';
    case Zid = 'zid';

    public function label(): string
    {
        return match ($this) {
            self::WooCommerce => 'WooCommerce',
            self::Shopify => 'Shopify',
            self::Amazon => 'Amazon',
            self::Noon => 'Noon',
            self::Salla => 'Salla',
            self::Zid => 'Zid',
        };
    }
}
