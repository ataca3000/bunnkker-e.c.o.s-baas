<?php

declare(strict_types=1);

namespace Modules\POS\Shared\Domain\Enums;

enum CartStatus: string
{
    case Empty = 'empty';
    case Active = 'active';
    case Held = 'held';
    case Paying = 'paying';
    case Completed = 'completed';
    case Cancelled = 'cancelled';
    case Expired = 'expired';

    /** A terminal state — no further transitions are possible. */
    public function isTerminal(): bool
    {
        return match ($this) {
            self::Completed, self::Cancelled, self::Expired => true,
            default => false,
        };
    }

    /** Cart accepts item additions only in the Active state. */
    public function canAddItems(): bool
    {
        return $this === self::Active;
    }

    public function canHold(): bool
    {
        return $this === self::Active;
    }

    /** Cart can initiate a payment screen only when Active. */
    public function canInitiatePayment(): bool
    {
        return $this === self::Active;
    }

    /**
     * Cart can cancel payment and return to Active state when Paying,
     * provided no payment method has been partially captured.
     * (ADR-POS-010: Paying → Active back-transition)
     */
    public function canCancelPayment(): bool
    {
        return $this === self::Paying;
    }

    /** @return list<self> */
    public static function terminalStates(): array
    {
        return [self::Completed, self::Cancelled, self::Expired];
    }
}
