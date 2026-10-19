<?php

declare(strict_types=1);

namespace Modules\POS\Shared\Domain\Enums;

enum SessionStatus: string
{
    case Open = 'open';
    case Suspended = 'suspended';
    case RecoveryPending = 'recovery_pending';
    case Closed = 'closed';

    /** The session is in an active or recoverable state. */
    public function isActive(): bool
    {
        return match ($this) {
            self::Open, self::Suspended, self::RecoveryPending => true,
            default => false,
        };
    }

    /** The cashier can process transactions. */
    public function canTransact(): bool
    {
        return $this === self::Open;
    }

    public function isTerminal(): bool
    {
        return $this === self::Closed;
    }

    /**
     * Recovery requires supervisor approval when on a different device.
     * (ADR-POS-008)
     */
    public function requiresSupervisorReview(): bool
    {
        return $this === self::RecoveryPending;
    }
}
