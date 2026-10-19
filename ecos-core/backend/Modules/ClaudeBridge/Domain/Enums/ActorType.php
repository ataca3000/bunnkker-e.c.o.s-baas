<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Domain\Enums;

enum ActorType: string
{
    case User = 'user';
    case Worker = 'worker';
    case System = 'system';
}
