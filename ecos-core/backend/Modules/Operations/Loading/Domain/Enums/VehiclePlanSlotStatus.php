<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Enums;

enum VehiclePlanSlotStatus: string
{
    case Unassigned = 'unassigned';
    case Assigned = 'assigned';
    case Confirmed = 'confirmed';
    case Loading = 'loading';
    case Dispatched = 'dispatched';
    case Completed = 'completed';

    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::Unassigned => in_array($next, [self::Assigned], true),
            self::Assigned => in_array($next, [self::Confirmed, self::Unassigned], true),
            self::Confirmed => in_array($next, [self::Loading, self::Assigned], true),
            self::Loading => in_array($next, [self::Dispatched], true),
            self::Dispatched => in_array($next, [self::Completed], true),
            self::Completed => false,
        };
    }

    public function isTerminal(): bool
    {
        return $this === self::Completed;
    }

    public function isActive(): bool
    {
        return ! $this->isTerminal();
    }
}
