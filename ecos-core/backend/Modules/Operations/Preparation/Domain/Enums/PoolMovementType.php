<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Enums;

enum PoolMovementType: string
{
    case Created = 'created';
    case Reserved = 'reserved';
    case ReservationReleased = 'reservation_released';
    case Loaded = 'loaded';
    case QualityFailed = 'quality_failed';
    case Reallocated = 'reallocated';
}
