<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Enums;

enum PickListItemStatus: string
{
    case Pending = 'pending';
    case InProgress = 'in_progress';
    case Picked = 'picked';
    case Short = 'short';
}
