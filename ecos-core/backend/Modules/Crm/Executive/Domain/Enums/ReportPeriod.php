<?php

declare(strict_types=1);

namespace Modules\Crm\Executive\Domain\Enums;

/** The reporting cadences the executive workspace supports. */
enum ReportPeriod: string
{
    case Monthly = 'monthly';
    case Quarterly = 'quarterly';
    case Annual = 'annual';
    case Custom = 'custom';

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
