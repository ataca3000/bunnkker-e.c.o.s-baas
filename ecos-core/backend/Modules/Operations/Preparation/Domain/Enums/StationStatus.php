<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Enums;

enum StationStatus: string
{
    case Active = 'active';
    case Inactive = 'inactive';
    case Maintenance = 'maintenance';
}
