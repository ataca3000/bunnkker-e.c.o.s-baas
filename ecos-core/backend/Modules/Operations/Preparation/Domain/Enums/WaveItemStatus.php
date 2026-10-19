<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Enums;

enum WaveItemStatus: string
{
    case Pending = 'pending';
    case InProgress = 'in_progress';
    case Prepared = 'prepared';
    case Short = 'short';
    case Blocked = 'blocked';

    public function isComplete(): bool
    {
        return match ($this) {
            self::Prepared, self::Short => true,
            default => false,
        };
    }
}
