<?php

declare(strict_types=1);

namespace Modules\POS\Receipt\Domain\Enums;

enum ReceiptType: string
{
    case Sale = 'sale';
    case Return = 'return';
    case Exchange = 'exchange';

    public function label(): string
    {
        return match ($this) {
            self::Sale => 'Sale',
            self::Return => 'Return',
            self::Exchange => 'Exchange',
        };
    }
}
