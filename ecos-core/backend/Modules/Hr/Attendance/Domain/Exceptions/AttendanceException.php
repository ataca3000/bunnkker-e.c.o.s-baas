<?php

declare(strict_types=1);

namespace Modules\Hr\Attendance\Domain\Exceptions;

use RuntimeException;

/** Every way the attendance domain refuses an instruction, named. */
final class AttendanceException extends RuntimeException
{
    public static function employeeNotEmployed(): self
    {
        return new self('Attendance cannot be registered for someone who has left the company.');
    }

    public static function leaveEndsBeforeItStarts(): self
    {
        return new self('A leave request cannot end before it starts.');
    }

    public static function invalidLeaveTransition(string $from, string $to): self
    {
        return new self("A leave request cannot move from {$from} to {$to}.");
    }

    public static function overlappingLeave(): self
    {
        return new self('This employee already has a leave request covering those dates.');
    }

    public static function crossCompany(): self
    {
        return new self('Attendance records cannot be linked across companies.');
    }

    public static function futureAttendance(): self
    {
        return new self('Attendance cannot be registered for a future date.');
    }
}
