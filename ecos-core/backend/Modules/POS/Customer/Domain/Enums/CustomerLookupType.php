<?php

declare(strict_types=1);

namespace Modules\POS\Customer\Domain\Enums;

enum CustomerLookupType: string
{
    case ById = 'id';
    case ByPhone = 'phone';
    case ByEmail = 'email';
    case ByCode = 'code';

    public function label(): string
    {
        return match ($this) {
            self::ById => 'Customer ID',
            self::ByPhone => 'Phone Number',
            self::ByEmail => 'Email Address',
            self::ByCode => 'Customer Code',
        };
    }
}
