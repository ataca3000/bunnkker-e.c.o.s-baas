<?php

declare(strict_types=1);

namespace Modules\Marketing\Initiatives\Domain\Enums;

enum InitiativeStatus: string
{
    case Draft = 'draft';
    case Active = 'active';
    case Paused = 'paused';
    case Completed = 'completed';
    case Archived = 'archived';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Active => 'Active',
            self::Paused => 'Paused',
            self::Completed => 'Completed',
            self::Archived => 'Archived',
            self::Cancelled => 'Cancelled',
        };
    }

    public function isRunning(): bool
    {
        return $this === self::Active;
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Completed, self::Archived, self::Cancelled]);
    }

    /** @return list<self> */
    public static function active(): array
    {
        return [self::Draft, self::Active, self::Paused];
    }
}
