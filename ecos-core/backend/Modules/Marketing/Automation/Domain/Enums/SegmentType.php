<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Domain\Enums;

enum SegmentType: string
{
    case DEMOGRAPHIC = 'demographic';
    case GEOGRAPHIC = 'geographic';
    case BEHAVIORAL = 'behavioral';
    case TRANSACTIONAL = 'transactional';
    case MARKETING = 'marketing';
    case BUSINESS = 'business';
    case OPERATIONAL = 'operational';
    case CUSTOM = 'custom';
}
