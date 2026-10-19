<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Domain\Enums;

enum WorkerStatus: string
{
    case Online = 'online';
    case Offline = 'offline';
}
