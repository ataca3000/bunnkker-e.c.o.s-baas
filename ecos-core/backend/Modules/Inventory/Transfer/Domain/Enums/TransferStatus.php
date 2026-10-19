<?php

declare(strict_types=1);

namespace Modules\Inventory\Transfer\Domain\Enums;

enum TransferStatus: string
{
    case Completed = 'completed';
    case Failed = 'failed';
    case Reversed = 'reversed';

    public function label(): string
    {
        return match ($this) {
            self::Completed => 'Completed',
            self::Failed => 'Failed',
            self::Reversed => 'Reversed',
        };
    }
}
