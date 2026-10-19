<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryControl\Domain\Enums;

enum AbcClass: string
{
    case A = 'A';
    case B = 'B';
    case C = 'C';

    public function label(): string
    {
        return match ($this) {
            self::A => 'Class A — High Value',
            self::B => 'Class B — Medium Value',
            self::C => 'Class C — Low Value',
        };
    }

    public function frequencyDays(): int
    {
        return match ($this) {
            self::A => 30,
            self::B => 90,
            self::C => 180,
        };
    }

    public function frequencyLabel(): string
    {
        return match ($this) {
            self::A => 'Monthly',
            self::B => 'Quarterly',
            self::C => 'Semi-Annual',
        };
    }

    /** Cumulative threshold at which a product is no longer in this class. */
    public static function thresholdFor(self $class): float
    {
        return match ($class) {
            self::A => 70.0,
            self::B => 90.0,
            self::C => 100.0,
        };
    }
}
