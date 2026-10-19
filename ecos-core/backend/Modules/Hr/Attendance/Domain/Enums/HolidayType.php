<?php

declare(strict_types=1);

namespace Modules\Hr\Attendance\Domain\Enums;

/** What kind of official holiday a non-working day is. */
enum HolidayType: string
{
    case Public = 'public';
    case Religious = 'religious';
    case National = 'national';
    case Company = 'company';

    /**
     * Whether the date moves year to year. Religious holidays follow the lunar
     * calendar — Eid Al-Fitr and Eid Al-Adha shift by roughly eleven days each
     * year, so they are recorded per occurrence rather than derived from a rule.
     */
    public function movesAnnually(): bool
    {
        return $this === self::Religious;
    }

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
