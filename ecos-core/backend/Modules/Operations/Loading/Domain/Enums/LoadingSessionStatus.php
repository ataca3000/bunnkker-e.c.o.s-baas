<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Enums;

enum LoadingSessionStatus: string
{
    case Draft = 'draft';
    case Ready = 'ready';
    case Loading = 'loading';
    case LoadingComplete = 'loading_complete';
    case Allocating = 'allocating';
    case Allocated = 'allocated';
    case Dispatching = 'dispatching';
    case Dispatched = 'dispatched';
    case Reconciling = 'reconciling';
    case Closed = 'closed';
    case Cancelled = 'cancelled';

    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::Draft => in_array($next, [self::Ready, self::Cancelled], true),
            self::Ready => in_array($next, [self::Loading, self::Cancelled], true),
            self::Loading => in_array($next, [self::LoadingComplete, self::Cancelled], true),
            self::LoadingComplete => in_array($next, [self::Allocating, self::Dispatching, self::Cancelled], true),
            self::Allocating => in_array($next, [self::Allocated, self::Cancelled], true),
            self::Allocated => in_array($next, [self::Dispatching, self::Cancelled], true),
            self::Dispatching => in_array($next, [self::Dispatched, self::Cancelled], true),
            self::Dispatched => in_array($next, [self::Reconciling, self::Closed], true),
            self::Reconciling => in_array($next, [self::Closed], true),
            self::Closed, self::Cancelled => false,
        };
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Closed, self::Cancelled], true);
    }

    public function isActive(): bool
    {
        return ! $this->isTerminal();
    }
}
