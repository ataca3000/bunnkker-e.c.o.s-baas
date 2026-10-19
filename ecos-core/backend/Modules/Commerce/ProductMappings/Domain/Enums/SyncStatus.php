<?php

declare(strict_types=1);

namespace Modules\Commerce\ProductMappings\Domain\Enums;

enum SyncStatus: string
{
    case Pending = 'pending';
    case Synced = 'synced';
    case Error = 'error';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending',
            self::Synced => 'Synced',
            self::Error => 'Error',
        };
    }
}
