<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Enums;

enum VehiclePlanStatus: string
{
    case Calculating = 'calculating';
    case Proposed = 'proposed';
    case Approved = 'approved';
    case Loading = 'loading';
    case Dispatched = 'dispatched';
    case Completed = 'completed';
    case Cancelled = 'cancelled';
    case Superseded = 'superseded';

    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::Calculating => in_array($next, [self::Proposed, self::Cancelled], true),
            self::Proposed => in_array($next, [self::Approved, self::Calculating, self::Cancelled], true),
            self::Approved => in_array($next, [self::Loading, self::Superseded, self::Cancelled], true),
            self::Loading => in_array($next, [self::Dispatched, self::Cancelled], true),
            self::Dispatched => in_array($next, [self::Completed], true),
            self::Completed, self::Cancelled, self::Superseded => false,
        };
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Completed, self::Cancelled, self::Superseded], true);
    }

    public function isActive(): bool
    {
        return ! $this->isTerminal();
    }
}
