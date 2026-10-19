<?php

declare(strict_types=1);

namespace Modules\Inventory\WarehouseLiabilities\Domain\Enums;

enum WarehouseLiabilityStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending',
            self::Approved => 'Approved',
            self::Rejected => 'Rejected',
        };
    }

    public function isTerminal(): bool
    {
        return $this === self::Approved || $this === self::Rejected;
    }
}
