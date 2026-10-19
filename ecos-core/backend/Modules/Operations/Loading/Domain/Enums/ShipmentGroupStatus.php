<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Enums;

enum ShipmentGroupStatus: string
{
    case Pending = 'pending';
    case Loading = 'loading';
    case Loaded = 'loaded';
    case Dispatched = 'dispatched';
    case Completed = 'completed';
    case Cancelled = 'cancelled';

    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::Pending => in_array($next, [self::Loading, self::Cancelled], true),
            self::Loading => in_array($next, [self::Loaded, self::Cancelled], true),
            self::Loaded => in_array($next, [self::Dispatched, self::Cancelled], true),
            self::Dispatched => in_array($next, [self::Completed], true),
            self::Completed, self::Cancelled => false,
        };
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Completed, self::Cancelled], true);
    }

    public function isActive(): bool
    {
        return ! $this->isTerminal();
    }
}
