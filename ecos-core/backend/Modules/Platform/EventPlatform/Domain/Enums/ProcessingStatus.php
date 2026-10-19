<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Domain\Enums;

enum ProcessingStatus: string
{
    case Processing = 'processing';
    case Succeeded = 'succeeded';
    case Failed = 'failed';
    case Skipped = 'skipped';
}
