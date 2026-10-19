<?php

declare(strict_types=1);

namespace Modules\Hr\Attendance\Domain\Enums;

/**
 * What happened on one working day for one person.
 *
 * Five plain outcomes, recorded by a supervisor. Nothing here is scored, totalled
 * or converted into an entitlement.
 */
enum AttendanceStatus: string
{
    case Present = 'present';
    case Absent = 'absent';
    case Leave = 'leave';
    case Holiday = 'holiday';
    case RestDay = 'rest_day';

    /** Did the company get work from this person on this day? */
    public function isWorked(): bool
    {
        return $this === self::Present;
    }

    /** Was the person expected but missing? */
    public function isUnplannedAbsence(): bool
    {
        return $this === self::Absent;
    }

    /** A day nobody was expected to work. */
    public function isNonWorkingDay(): bool
    {
        return in_array($this, [self::Holiday, self::RestDay], true);
    }

    public function label(): string
    {
        return match ($this) {
            self::Present => 'Present',
            self::Absent => 'Absent',
            self::Leave => 'On Leave',
            self::Holiday => 'Holiday',
            self::RestDay => 'Rest Day',
        };
    }
}
