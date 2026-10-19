<?php

declare(strict_types=1);

namespace Modules\POS\Terminal\Domain\Enums;

enum TerminalStatus: string
{
    case Active = 'active';
    case Inactive = 'inactive';
    case Maintenance = 'maintenance';

    /** Only Active terminals may open a new cashier session. */
    public function canAcceptSessions(): bool
    {
        return $this === self::Active;
    }

    /** Active and Maintenance terminals are physically present and managed. */
    public function isOperational(): bool
    {
        return $this !== self::Inactive;
    }

    public function label(): string
    {
        return match ($this) {
            self::Active => 'Active',
            self::Inactive => 'Inactive',
            self::Maintenance => 'Under Maintenance',
        };
    }
}
