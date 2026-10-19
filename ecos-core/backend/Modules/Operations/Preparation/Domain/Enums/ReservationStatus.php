<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Enums;

enum ReservationStatus: string
{
    case Created = 'created';   // Active soft-lock on inventory
    case Updated = 'updated';   // Quantity adjusted after recalculation
    case Released = 'released';  // Wave cancelled — stock freed
    case Consumed = 'consumed';  // Wave completed — stock used
}
