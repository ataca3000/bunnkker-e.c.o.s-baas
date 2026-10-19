<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Enums;

enum LoadingTaskStatus: string
{
    case Pending = 'pending';
    case InProgress = 'in_progress';
    case Loaded = 'loaded';
    case ShortLoaded = 'short_loaded';
    case Blocked = 'blocked';
    case Skipped = 'skipped';

    public function canTransitionTo(self $next): bool
    {
        return match ($this) {
            self::Pending => in_array($next, [self::InProgress, self::Blocked, self::Skipped], true),
            self::InProgress => in_array($next, [self::Loaded, self::ShortLoaded, self::Blocked], true),
            self::Blocked => in_array($next, [self::InProgress, self::Skipped], true),
            self::Loaded, self::ShortLoaded, self::Skipped => false,
        };
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Loaded, self::ShortLoaded, self::Blocked, self::Skipped], true);
    }

    public function isActive(): bool
    {
        return ! $this->isTerminal();
    }
}
