<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Enums;

enum QueueStatus: string
{
    case Pending   = 'pending';
    case Assigned  = 'assigned';
    case Running   = 'running';
    case Paused    = 'paused';
    case Cancelled = 'cancelled';
    case Completed = 'completed';
    case Expired   = 'expired';

    public function isTerminal(): bool
    {
        return in_array($this, [self::Cancelled, self::Completed, self::Expired]);
    }

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
