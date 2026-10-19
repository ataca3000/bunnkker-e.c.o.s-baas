<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Domain\Enums;

enum ChannelProviderStatus: string
{
    case ACTIVE = 'active';
    case INACTIVE = 'inactive';
    case ERROR = 'error';
}
