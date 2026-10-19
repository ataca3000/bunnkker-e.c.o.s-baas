<?php

declare(strict_types=1);

namespace Modules\POS\Exchange\Domain\Enums;

enum ExchangeReason: string
{
    case Defective = 'defective';
    case WrongItem = 'wrong_item';
    case CustomerPreference = 'customer_preference';
    case SizeExchange = 'size_exchange';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Defective => 'Defective Item',
            self::WrongItem => 'Wrong Item Received',
            self::CustomerPreference => 'Customer Preference',
            self::SizeExchange => 'Size Exchange',
            self::Other => 'Other',
        };
    }

    public function requiresNote(): bool
    {
        return $this === self::Other;
    }
}
