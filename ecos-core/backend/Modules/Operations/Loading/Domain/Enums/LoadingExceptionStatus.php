<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Enums;

enum LoadingExceptionStatus: string
{
    case Open = 'open';
    case Investigating = 'investigating';
    case Resolved = 'resolved';
    case Escalated = 'escalated';

    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::Open => in_array($next, [self::Investigating, self::Resolved, self::Escalated], true),
            self::Investigating => in_array($next, [self::Resolved, self::Escalated], true),
            self::Escalated => in_array($next, [self::Investigating, self::Resolved], true),
            self::Resolved => false,
        };
    }

    public function isTerminal(): bool
    {
        return $this === self::Resolved;
    }

    public function isActive(): bool
    {
        return ! $this->isTerminal();
    }
}
