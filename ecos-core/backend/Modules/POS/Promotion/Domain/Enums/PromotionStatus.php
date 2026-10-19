<?php

declare(strict_types=1);

namespace Modules\POS\Promotion\Domain\Enums;

enum PromotionStatus: string
{
    case Draft = 'draft';
    case Active = 'active';
    case Paused = 'paused';
    case Expired = 'expired';
    case Cancelled = 'cancelled';

    public function isTerminal(): bool
    {
        return match ($this) {
            self::Expired, self::Cancelled => true,
            default => false,
        };
    }

    public function canActivate(): bool
    {
        return match ($this) {
            self::Draft, self::Paused => true,
            default => false,
        };
    }

    public function canPause(): bool
    {
        return $this === self::Active;
    }

    public function canExpire(): bool
    {
        return $this === self::Active || $this === self::Paused;
    }

    public function canCancel(): bool
    {
        return ! $this->isTerminal();
    }
}
