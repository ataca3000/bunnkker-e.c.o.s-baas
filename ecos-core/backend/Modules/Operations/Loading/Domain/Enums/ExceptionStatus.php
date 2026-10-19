<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Enums;

enum ExceptionStatus: string
{
    case Open = 'open';
    case Investigating = 'investigating';
    case Resolved = 'resolved';
    case Escalated = 'escalated';
}
