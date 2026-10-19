<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Enums;

enum VehicleInventoryItemStatus: string
{
    case Active = 'active';
    case Depleted = 'depleted';
    case Returned = 'returned';
    case Variance = 'variance';

    public function isTerminal(): bool
    {
        return in_array($this, [self::Depleted, self::Returned, self::Variance], true);
    }

    public function isActive(): bool
    {
        return $this === self::Active;
    }
}
