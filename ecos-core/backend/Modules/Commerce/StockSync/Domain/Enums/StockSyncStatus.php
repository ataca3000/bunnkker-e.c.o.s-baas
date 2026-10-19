<?php

declare(strict_types=1);

namespace Modules\Commerce\StockSync\Domain\Enums;

enum StockSyncStatus: string
{
    case Pending = 'pending';
    case Success = 'success';
    case Error = 'error';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending',
            self::Success => 'Success',
            self::Error => 'Error',
        };
    }
}
