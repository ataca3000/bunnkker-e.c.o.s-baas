<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Domain\Enums;

enum TaskPriority: string
{
    case Low = 'low';
    case Normal = 'normal';
    case High = 'high';

    public function weight(): int
    {
        return match ($this) {
            self::High => 3,
            self::Normal => 2,
            self::Low => 1,
        };
    }
}
