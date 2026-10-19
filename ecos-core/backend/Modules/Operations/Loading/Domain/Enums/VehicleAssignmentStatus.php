<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Enums;

enum VehicleAssignmentStatus: string
{
    case Pending = 'pending';
    case Loading = 'loading';
    case LoadingComplete = 'loading_complete';
    case Dispatched = 'dispatched';
    case Returning = 'returning';
    case Reconciling = 'reconciling';
    case Reconciled = 'reconciled';
    case Cancelled = 'cancelled';

    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::Pending => in_array($next, [self::Loading, self::Cancelled], true),
            self::Loading => in_array($next, [self::LoadingComplete, self::Cancelled], true),
            self::LoadingComplete => in_array($next, [self::Dispatched, self::Cancelled], true),
            self::Dispatched => in_array($next, [self::Returning], true),
            self::Returning => in_array($next, [self::Reconciling], true),
            self::Reconciling => in_array($next, [self::Reconciled], true),
            self::Reconciled, self::Cancelled => false,
        };
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Reconciled, self::Cancelled], true);
    }

    public function isActive(): bool
    {
        return ! $this->isTerminal();
    }
}
