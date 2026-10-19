<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Enums;

/**
 * How far along an exit is.
 *
 * `Completed` is the state that actually changes the employee record, and it is
 * the one the checklist stands in front of.
 */
enum ExitStatus: string
{
    case Initiated = 'initiated';
    case InProgress = 'in_progress';
    case Completed = 'completed';
    case Cancelled = 'cancelled';

    /** Checklist items can still be worked on. */
    public function isOpen(): bool
    {
        return in_array($this, [self::Initiated, self::InProgress], true);
    }

    /** @return array<int, self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Initiated => [self::InProgress, self::Completed, self::Cancelled],
            self::InProgress => [self::Completed, self::Cancelled],
            // A completed exit wrote a lifecycle event and changed the employee's
            // status. Reopening it would leave that record describing a past that
            // no longer happened; the way back is a rehire, which is its own event.
            self::Completed, self::Cancelled => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    public function label(): string
    {
        return match ($this) {
            self::Initiated => 'Initiated',
            self::InProgress => 'In Progress',
            self::Completed => 'Completed',
            self::Cancelled => 'Cancelled',
        };
    }
}
