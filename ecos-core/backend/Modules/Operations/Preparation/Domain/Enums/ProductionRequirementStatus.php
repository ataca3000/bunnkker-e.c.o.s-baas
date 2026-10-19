<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Enums;

enum ProductionRequirementStatus: string
{
    case Pending = 'pending';
    case JobCreated = 'job_created';
    case Manufacturing = 'manufacturing';
    case Ready = 'ready';
}
