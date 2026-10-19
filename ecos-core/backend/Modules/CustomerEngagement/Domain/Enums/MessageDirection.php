<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Domain\Enums;

enum MessageDirection: string
{
    case Inbound = 'inbound';
    case Outbound = 'outbound';
}
