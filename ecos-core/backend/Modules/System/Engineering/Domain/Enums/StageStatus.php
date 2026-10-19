<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Enums;

enum StageStatus: string
{
    case Pending   = 'pending';
    case Running   = 'running';
    case Success   = 'success';
    case Failed    = 'failed';
    case Retrying  = 'retrying';
    case Skipped   = 'skipped';
    case Cancelled = 'cancelled';

    public function isTerminal(): bool
    {
        return in_array($this, [self::Success, self::Failed, self::Skipped, self::Cancelled], true);
    }

    public function canRetry(): bool
    {
        return $this === self::Failed;
    }
}
