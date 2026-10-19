<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Enums;

enum ExceptionSeverity: string
{
    case Blocking = 'blocking';
    case Warning = 'warning';
    case Informational = 'informational';
}
