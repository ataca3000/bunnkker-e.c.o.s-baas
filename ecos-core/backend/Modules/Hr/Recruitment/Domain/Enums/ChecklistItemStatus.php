<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Enums;

/**
 * Whether one clearance item is settled.
 *
 * Three of these four settle an item, and they mean different things. Completed
 * means it happened; not-applicable means it never applied — a driver has no
 * laptop to return; waived means it DID apply and someone decided to let it go.
 * Only the last needs a reason, and only the last should ever be questioned.
 */
enum ChecklistItemStatus: string
{
    case Pending = 'pending';
    case Completed = 'completed';
    case Waived = 'waived';
    case NotApplicable = 'not_applicable';

    /** Does this item still block the exit? */
    public function isOutstanding(): bool
    {
        return $this === self::Pending;
    }

    /** Settled in a way that lets the exit proceed. */
    public function isSettled(): bool
    {
        return ! $this->isOutstanding();
    }

    /** Only a waiver needs someone to justify it. */
    public function requiresReason(): bool
    {
        return $this === self::Waived;
    }

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending',
            self::Completed => 'Completed',
            self::Waived => 'Waived',
            self::NotApplicable => 'Not Applicable',
        };
    }
}
