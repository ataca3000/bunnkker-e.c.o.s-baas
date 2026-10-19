<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Enums;

enum StationType: string
{
    case Picking = 'picking';
    case Assembly = 'assembly';
    case QualityCheck = 'quality_check';
    case Packaging = 'packaging';
    case Storage = 'storage';
}
