<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Enums;

enum PickListStatus: string
{
    case Pending = 'pending';
    case InProgress = 'in_progress';
    case Completed = 'completed';
}
