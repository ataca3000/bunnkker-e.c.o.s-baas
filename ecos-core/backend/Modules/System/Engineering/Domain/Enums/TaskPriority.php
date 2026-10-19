<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Enums;

enum TaskPriority: int
{
    case Critical = 10;
    case High     = 8;
    case Medium   = 5;
    case Low      = 3;
    case Minimal  = 1;

    public function label(): string
    {
        return match ($this) {
            self::Critical => 'Critical',
            self::High     => 'High',
            self::Medium   => 'Medium',
            self::Low      => 'Low',
            self::Minimal  => 'Minimal',
        };
    }

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
