<?php

declare(strict_types=1);

namespace Modules\POS\Shared\Domain\Enums;

enum CashDrawerStatus: string
{
    case Open = 'open';
    case Closed = 'closed';

    public function isTerminal(): bool
    {
        return $this === self::Closed;
    }

    public function isOpen(): bool
    {
        return $this === self::Open;
    }
}
