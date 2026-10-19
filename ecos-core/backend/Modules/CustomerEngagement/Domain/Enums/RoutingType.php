<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Domain\Enums;

enum RoutingType: string
{
    case AUTO = 'auto';
    case ROUND_ROBIN = 'round_robin';
    case SKILL_BASED = 'skill_based';
    case MANUAL = 'manual';
}
