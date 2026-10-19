<?php

declare(strict_types=1);

namespace Modules\POS\Session\Domain\Enums;

enum DeviceType: string
{
    case Browser = 'browser';
    case Mobile = 'mobile';
    case Agent = 'agent';

    public function label(): string
    {
        return match ($this) {
            self::Browser => 'Web Browser',
            self::Mobile => 'Mobile Device',
            self::Agent => 'Hardware Agent',
        };
    }
}
