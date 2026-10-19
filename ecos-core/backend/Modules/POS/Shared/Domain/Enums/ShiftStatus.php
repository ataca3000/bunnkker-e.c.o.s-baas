<?php

declare(strict_types=1);

namespace Modules\POS\Shared\Domain\Enums;

/**
 * Shift lifecycle states.
 *
 * ADR-POS-006: On supervisor rejection, the shift returns to Closing (not a
 * separate Rejected terminal state). The cashier corrects and resubmits.
 */
enum ShiftStatus: string
{
    case Open = 'open';
    case Closing = 'closing';
    case Closed = 'closed';

    /** New sales can only be processed on an Open shift. */
    public function canProcessSales(): bool
    {
        return $this === self::Open;
    }

    /** Cashier is in the process of closing (submitted for supervisor review). */
    public function isAwaitingApproval(): bool
    {
        return $this === self::Closing;
    }

    public function isTerminal(): bool
    {
        return $this === self::Closed;
    }
}
