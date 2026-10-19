<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Enums;

enum WorkerSessionStatus: string
{
    case Preparing  = 'preparing';
    case Running    = 'running';
    case Paused     = 'paused';
    case Completing = 'completing';
    case Completed  = 'completed';
    case Failed     = 'failed';
    case Aborted    = 'aborted';

    public function isTerminal(): bool
    {
        return in_array($this, [self::Completed, self::Failed, self::Aborted]);
    }

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
