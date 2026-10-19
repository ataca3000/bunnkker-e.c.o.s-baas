<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Enums;

/**
 * The approval lifecycle shared by bonuses, deductions and advances.
 *
 * One enum rather than three identical ones: they all follow the same path, and
 * the rule that matters — only an APPROVED item reaches a payslip — is stated
 * once here instead of being re-checked in three engines.
 */
enum ApprovalStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Cancelled = 'cancelled';

    /** The only status that affects someone's pay. */
    public function affectsPay(): bool
    {
        return $this === self::Approved;
    }

    public function isDecided(): bool
    {
        return $this !== self::Pending;
    }

    /** @return array<int, self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Pending => [self::Approved, self::Rejected, self::Cancelled],
            self::Approved => [self::Cancelled],
            self::Rejected, self::Cancelled => [],
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
