<?php

declare(strict_types=1);

namespace Modules\POS\Payment\Domain\Enums;

enum PaymentStatus: string
{
    case Pending = 'pending';
    case Captured = 'captured';

    public function isTerminal(): bool
    {
        return $this === self::Captured;
    }

    public function isPending(): bool
    {
        return $this === self::Pending;
    }

    public function isCaptured(): bool
    {
        return $this === self::Captured;
    }
}
