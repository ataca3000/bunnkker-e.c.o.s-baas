<?php

declare(strict_types=1);

namespace Modules\POS\Shared\Domain\Enums;

enum TransactionType: string
{
    case Sale = 'sale';
    case Return = 'return';
    case Exchange = 'exchange';
    case CashIn = 'cash_in';
    case CashOut = 'cash_out';
    case OpeningFloat = 'opening_float';
    case ClosingCount = 'closing_count';

    /**
     * Determines whether this transaction type affects the physical cash drawer balance.
     * Sale/Return/Exchange affect cash only if the payment method is Cash.
     * CashIn / CashOut / OpeningFloat / ClosingCount always affect the drawer.
     */
    public function alwaysAffectsCashDrawer(): bool
    {
        return match ($this) {
            self::CashIn, self::CashOut, self::OpeningFloat, self::ClosingCount => true,
            default => false,
        };
    }

    public function isDrawerMovement(): bool
    {
        return match ($this) {
            self::CashIn, self::CashOut, self::OpeningFloat => true,
            default => false,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Sale => 'Sale',
            self::Return => 'Return',
            self::Exchange => 'Exchange',
            self::CashIn => 'Cash In',
            self::CashOut => 'Cash Out',
            self::OpeningFloat => 'Opening Float',
            self::ClosingCount => 'Closing Count',
        };
    }
}
