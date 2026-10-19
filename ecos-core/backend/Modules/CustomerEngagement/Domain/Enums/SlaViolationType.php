<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Domain\Enums;

enum SlaViolationType: string
{
    case FirstResponse = 'first_response';
    case Resolution = 'resolution';
}
