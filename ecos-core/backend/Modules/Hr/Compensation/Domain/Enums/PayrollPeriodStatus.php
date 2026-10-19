<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Enums;

/**
 * The life of a payroll period.
 *
 * Approval is the meaningful gate: before it the numbers can be recalculated
 * freely, after it they are final and Finance has been told.
 */
enum PayrollPeriodStatus: string
{
    case Draft = 'draft';
    case Open = 'open';
    case Calculated = 'calculated';
    case Approved = 'approved';
    case Closed = 'closed';

    /** Can compensation still be recalculated? */
    public function isRecalculable(): bool
    {
        return in_array($this, [self::Open, self::Calculated], true);
    }

    /** Can bonuses, deductions and advances still be attached? */
    public function acceptsAdjustments(): bool
    {
        return in_array($this, [self::Draft, self::Open, self::Calculated], true);
    }

    public function isFinal(): bool
    {
        return in_array($this, [self::Approved, self::Closed], true);
    }

    /** @return array<int, self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Draft => [self::Open],
            self::Open => [self::Calculated, self::Draft],
            self::Calculated => [self::Approved, self::Open],
            self::Approved => [self::Closed],
            self::Closed => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
