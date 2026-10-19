<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Enums;

enum MovementType: string
{
    case Loaded = 'loaded';
    case Allocated = 'allocated';
    case Unallocated = 'unallocated';
    case Delivered = 'delivered';
    case Returned = 'returned';
    case Adjusted = 'adjusted';
}
