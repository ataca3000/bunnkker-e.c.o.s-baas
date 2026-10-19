<?php

declare(strict_types=1);

namespace Modules\Marketing\Connections\Domain\Enums;

enum ConnectorType: string
{
    case Meta = 'meta';
    case GoogleAds = 'google_ads';
    case TikTok = 'tiktok';
    case Snapchat = 'snapchat';
    case LinkedIn = 'linkedin';
    case Pinterest = 'pinterest';
    case XAds = 'x_ads';

    public function label(): string
    {
        return match ($this) {
            self::Meta => 'Meta (Facebook / Instagram)',
            self::GoogleAds => 'Google Ads',
            self::TikTok => 'TikTok Ads',
            self::Snapchat => 'Snapchat Ads',
            self::LinkedIn => 'LinkedIn Ads',
            self::Pinterest => 'Pinterest Ads',
            self::XAds => 'X Ads',
        };
    }
}
