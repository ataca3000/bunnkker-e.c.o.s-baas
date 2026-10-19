<?php

declare(strict_types=1);

namespace Modules\Marketing\Synchronization\Domain\Enums;

enum SyncType: string
{
    case Manual = 'manual';
    case Scheduled = 'scheduled';
    case Incremental = 'incremental';
    case Full = 'full';
}
