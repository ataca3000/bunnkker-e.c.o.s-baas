<?php

declare(strict_types=1);

namespace Modules\POS\Receipt\Domain\Enums;

enum ReceiptStatus: string
{
    case Issued = 'issued';
    case Voided = 'voided';

    public function label(): string
    {
        return match ($this) {
            self::Issued => 'Issued',
            self::Voided => 'Voided',
        };
    }

    public function isActive(): bool
    {
        return $this === self::Issued;
    }

    public function canBeVoided(): bool
    {
        return $this === self::Issued;
    }
}
