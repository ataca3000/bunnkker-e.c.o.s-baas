<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Enums;

/** How a metric's facts roll up over a period. */
enum KpiAggregation: string
{
    case Sum = 'sum';
    case Average = 'average';
    case Latest = 'latest';

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
