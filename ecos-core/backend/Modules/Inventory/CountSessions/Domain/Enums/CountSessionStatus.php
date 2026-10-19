<?php

declare(strict_types=1);

namespace Modules\Inventory\CountSessions\Domain\Enums;

enum CountSessionStatus: string
{
    case Draft = 'draft';
    case InProgress = 'in_progress';
    case Completed = 'completed';
    case Approved = 'approved';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::InProgress => 'In Progress',
            self::Completed => 'Pending Approval',
            self::Approved => 'Approved',
            self::Cancelled => 'Cancelled',
        };
    }

    /** Allowed transitions: from → to */
    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::Draft => $next === self::InProgress || $next === self::Cancelled,
            self::InProgress => $next === self::Completed || $next === self::Cancelled,
            self::Completed => $next === self::Approved,
            default => false,
        };
    }
}
