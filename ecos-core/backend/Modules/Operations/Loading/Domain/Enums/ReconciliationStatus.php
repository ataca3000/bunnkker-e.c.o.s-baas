<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Enums;

enum ReconciliationStatus: string
{
    case Open = 'open';
    case Completed = 'completed';
    case Approved = 'approved';
    case Disputed = 'disputed';

    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::Open => in_array($next, [self::Completed, self::Disputed], true),
            self::Completed => in_array($next, [self::Approved, self::Disputed], true),
            self::Disputed => in_array($next, [self::Completed], true),
            self::Approved => false,
        };
    }

    public function isTerminal(): bool
    {
        return $this === self::Approved;
    }

    public function isActive(): bool
    {
        return ! $this->isTerminal();
    }
}
