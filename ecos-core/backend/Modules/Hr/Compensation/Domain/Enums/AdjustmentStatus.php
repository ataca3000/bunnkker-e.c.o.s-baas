<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Enums;

/**
 * The life of a correction against approved pay.
 *
 * `Applied` is separate from `Approved` on purpose: approving says the company
 * accepts it is owed, applying says a payslip actually carried it. Between those
 * two an adjustment is a liability nobody has paid yet, and that gap is exactly
 * what someone chasing a missing correction needs to see.
 */
enum AdjustmentStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Applied = 'applied';
    case Cancelled = 'cancelled';

    /** Waiting on a decision or on a payroll run. */
    public function isOpen(): bool
    {
        return in_array($this, [self::Pending, self::Approved], true);
    }

    /** Approved and not yet carried by a payslip — money owed. */
    public function isPayable(): bool
    {
        return $this === self::Approved;
    }

    /** @return array<int, self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Pending => [self::Approved, self::Rejected, self::Cancelled],
            self::Approved => [self::Applied, self::Cancelled],
            // Once a payslip has carried it, it is history like any other pay line.
            self::Applied, self::Rejected, self::Cancelled => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending Approval',
            self::Approved => 'Approved',
            self::Rejected => 'Rejected',
            self::Applied => 'Applied',
            self::Cancelled => 'Cancelled',
        };
    }
}
