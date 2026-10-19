<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Enums;

enum ExceptionStatus: string
{
    case Open = 'open';
    case Resolved = 'resolved';
    case Escalated = 'escalated';
    case Closed = 'closed';
}
