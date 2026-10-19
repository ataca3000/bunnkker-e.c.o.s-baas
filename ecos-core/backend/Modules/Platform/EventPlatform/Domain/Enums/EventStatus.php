<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Domain\Enums;

enum EventStatus: string
{
    case Pending = 'pending';
    case Published = 'published';
    case Processing = 'processing';
    case Succeeded = 'succeeded';
    case Failed = 'failed';
    case DeadLettered = 'dead_lettered';
    case Replaying = 'replaying';
    case Replayed = 'replayed';
}
