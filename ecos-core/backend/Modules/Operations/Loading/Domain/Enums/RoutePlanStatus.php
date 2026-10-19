<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Enums;

enum RoutePlanStatus: string
{
    case Planned = 'planned';
    case InProgress = 'in_progress';
    case Completed = 'completed';
    case Cancelled = 'cancelled';
    case Superseded = 'superseded';

    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::Planned => in_array($next, [self::InProgress, self::Cancelled, self::Superseded], true),
            self::InProgress => in_array($next, [self::Completed, self::Cancelled], true),
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
