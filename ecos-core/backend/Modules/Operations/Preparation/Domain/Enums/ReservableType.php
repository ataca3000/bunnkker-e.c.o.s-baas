<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Enums;

enum ReservableType: string
{
    case RawMaterial = 'raw_material';
    case FinishedGood = 'finished_good';
}
