<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Enums;

enum DriverAssignmentType: string
{
    case Primary = 'primary';
    case Substitute = 'substitute';
}
