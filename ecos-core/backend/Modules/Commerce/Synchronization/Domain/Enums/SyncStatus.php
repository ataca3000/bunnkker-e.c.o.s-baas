<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Domain\Enums;

enum SyncStatus: string
{
    case Pending = 'pending';
    case Processing = 'processing';
    case Success = 'success';
    case Failed = 'failed';
    case Skipped = 'skipped';
}
