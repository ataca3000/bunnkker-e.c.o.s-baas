<?php

declare(strict_types=1);

namespace Modules\POS\Shared\Domain\Enums;

enum ReturnStatus: string
{
    case Pending = 'pending';
    case Processed = 'processed';
    case Cancelled = 'cancelled';

    public function isTerminal(): bool
    {
        return $this !== self::Pending;
    }

    public function canBeProcessed(): bool
    {
        return $this === self::Pending;
    }

    public function canBeCancelled(): bool
    {
        return $this === self::Pending;
    }
}
