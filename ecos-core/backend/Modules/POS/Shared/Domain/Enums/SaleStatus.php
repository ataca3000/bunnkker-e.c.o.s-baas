<?php

declare(strict_types=1);

namespace Modules\POS\Shared\Domain\Enums;

enum SaleStatus: string
{
    case Pending = 'pending';
    case Completed = 'completed';
    case Voided = 'voided';
    case Refunded = 'refunded';
    case PartiallyRefunded = 'partially_refunded';

    public function isTerminal(): bool
    {
        return match ($this) {
            self::Voided, self::Refunded => true,
            default => false,
        };
    }

    public function canBeRefunded(): bool
    {
        return match ($this) {
            self::Completed, self::PartiallyRefunded => true,
            default => false,
        };
    }

    public function canBeVoided(): bool
    {
        return $this === self::Pending;
    }
}
