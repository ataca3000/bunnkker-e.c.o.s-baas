<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Enums;

/** The life of one calculation of a period. */
enum PayrollRunStatus: string
{
    case Draft = 'draft';
    case Calculated = 'calculated';
    case Approved = 'approved';
    case Cancelled = 'cancelled';

    public function isApproved(): bool
    {
        return $this === self::Approved;
    }

    /** @return array<int, self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Draft => [self::Calculated, self::Cancelled],
            self::Calculated => [self::Approved, self::Cancelled, self::Draft],
            // Approved payroll is never rewound — a correction is a new run.
            self::Approved, self::Cancelled => [],
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
