<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Domain\Enums;

/**
 * The nature of a reporting relationship.
 *
 * Only the primary line builds the organisation chart; dotted and functional
 * lines describe real working relationships without competing for the same slot.
 */
enum ReportingLineType: string
{
    case Primary = 'primary';
    case Dotted = 'dotted';
    case Functional = 'functional';

    public function buildsOrgChart(): bool
    {
        return $this === self::Primary;
    }

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
