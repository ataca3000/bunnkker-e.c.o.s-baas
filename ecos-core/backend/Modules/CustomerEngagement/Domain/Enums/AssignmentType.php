<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Domain\Enums;

enum AssignmentType: string
{
    case Manual = 'manual';
    case RoundRobin = 'round_robin';
    case Department = 'department';
    case Language = 'language';
    case Brand = 'brand';
    case Channel = 'channel';
    case Campaign = 'campaign';
    case AiRouting = 'ai_routing';
}
