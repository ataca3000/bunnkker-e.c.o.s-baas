<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Enums;

enum WorkerRole: string
{
    case Supervisor = 'supervisor';
    case Operator = 'operator';
    case QualityChecker = 'quality_checker';
}
