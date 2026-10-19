<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Domain\Enums;

enum LeadStatus: string
{
    case New = 'new';
    case Contacted = 'contacted';
    case Qualified = 'qualified';
    case Unqualified = 'unqualified';
    case Converted = 'converted';
    case Lost = 'lost';

    public function label(): string
    {
        return match ($this) {
            self::New => 'New',
            self::Contacted => 'Contacted',
            self::Qualified => 'Qualified',
            self::Unqualified => 'Unqualified',
            self::Converted => 'Converted',
            self::Lost => 'Lost',
        };
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Converted, self::Lost, self::Unqualified]);
    }
}
