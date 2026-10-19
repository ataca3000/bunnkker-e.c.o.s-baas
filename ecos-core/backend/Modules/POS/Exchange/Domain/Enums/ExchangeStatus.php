<?php

declare(strict_types=1);

namespace Modules\POS\Exchange\Domain\Enums;

enum ExchangeStatus: string
{
    case Draft = 'draft';
    case Confirmed = 'confirmed';
    case Completed = 'completed';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Confirmed => 'Confirmed',
            self::Completed => 'Completed',
            self::Cancelled => 'Cancelled',
        };
    }

    public function isTerminal(): bool
    {
        return $this === self::Completed || $this === self::Cancelled;
    }

    public function canBeConfirmed(): bool
    {
        return $this === self::Draft;
    }

    public function canBeCompleted(): bool
    {
        return $this === self::Confirmed;
    }

    public function canBeCancelled(): bool
    {
        return ! $this->isTerminal();
    }
}
