<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Enums;

/**
 * Whether a job is open, and — critically — whether the public can see it.
 *
 * Opening and closing a job is a status change on a row, never a code change.
 */
enum JobOpeningStatus: string
{
    case Draft = 'draft';
    case Published = 'published';
    case OnHold = 'on_hold';
    case Closed = 'closed';
    case Filled = 'filled';

    /** The ONLY status the careers portal will ever show. */
    public function isPubliclyVisible(): bool
    {
        return $this === self::Published;
    }

    /** Whether an application can still be submitted against it. */
    public function acceptsApplications(): bool
    {
        return $this === self::Published;
    }

    /** @return array<int, self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Draft => [self::Published, self::Closed],
            self::Published => [self::OnHold, self::Closed, self::Filled],
            self::OnHold => [self::Published, self::Closed],
            // A closed or filled opening is reopened by publishing a new one.
            self::Closed, self::Filled => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Published => 'Published',
            self::OnHold => 'On Hold',
            self::Closed => 'Closed',
            self::Filled => 'Filled',
        };
    }
}
