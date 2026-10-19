<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Enums;

/** The life of an advance, from request to fully recovered. */
enum AdvanceStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Active = 'active';
    case Settled = 'settled';
    case Cancelled = 'cancelled';

    /** Installments are only recovered while the advance is live. */
    public function isRecoverable(): bool
    {
        return in_array($this, [self::Approved, self::Active], true);
    }

    /** @return array<int, self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Pending => [self::Approved, self::Cancelled],
            self::Approved => [self::Active, self::Settled, self::Cancelled],
            self::Active => [self::Settled, self::Cancelled],
            self::Settled, self::Cancelled => [],
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
