<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Domain\Enums;

/**
 * A lead's qualification lifecycle: new → contacted → qualified (or
 * unqualified) → converted. Converting a qualified lead creates/links a customer
 * (C1) and opens an opportunity.
 */
enum LeadStatus: string
{
    case New = 'new';
    case Contacted = 'contacted';
    case Qualified = 'qualified';
    case Unqualified = 'unqualified';
    case Converted = 'converted';

    public function isConverted(): bool
    {
        return $this === self::Converted;
    }

    public function isClosed(): bool
    {
        return $this === self::Converted || $this === self::Unqualified;
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }
}
