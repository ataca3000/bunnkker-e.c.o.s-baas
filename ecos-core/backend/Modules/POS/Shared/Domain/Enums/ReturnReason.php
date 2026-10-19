<?php

declare(strict_types=1);

namespace Modules\POS\Shared\Domain\Enums;

enum ReturnReason: string
{
    case Defective = 'defective';
    case WrongItem = 'wrong_item';
    case CustomerPreference = 'customer_preference';
    case Other = 'other';

    /** Defective items should typically be flagged for quality review, not restocked. */
    public function shouldRestock(): bool
    {
        return match ($this) {
            self::Defective => false,
            default => true,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Defective => 'Defective / Damaged',
            self::WrongItem => 'Wrong Item',
            self::CustomerPreference => 'Customer Changed Mind',
            self::Other => 'Other',
        };
    }
}
