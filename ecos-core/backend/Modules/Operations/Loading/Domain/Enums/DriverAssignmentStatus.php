<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Enums;

enum DriverAssignmentStatus: string
{
    case Assigned = 'assigned';
    case OnTrip = 'on_trip';
    case Returned = 'returned';
    case Reconciled = 'reconciled';
    case Cancelled = 'cancelled';
    case Reassigned = 'reassigned';

    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::Assigned => in_array($next, [self::OnTrip, self::Cancelled, self::Reassigned], true),
            self::OnTrip => in_array($next, [self::Returned], true),
            self::Returned => in_array($next, [self::Reconciled], true),
            self::Reconciled, self::Cancelled, self::Reassigned => false,
        };
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Reconciled, self::Cancelled, self::Reassigned], true);
    }

    public function isActive(): bool
    {
        return ! $this->isTerminal();
    }
}
