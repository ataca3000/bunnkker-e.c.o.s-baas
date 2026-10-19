<?php

declare(strict_types=1);

namespace Modules\Commerce\Channels\Domain\Enums;

enum ChannelHealthStatus: string
{
    case Healthy = 'healthy';
    case Warning = 'warning';
    case Error = 'error';
}
