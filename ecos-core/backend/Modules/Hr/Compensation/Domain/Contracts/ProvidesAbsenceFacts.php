<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Contracts;

/**
 * The port through which Compensation asks Attendance what happened.
 *
 * ┌─ ATTENDANCE OWNS THE EVENTS · PAYROLL OWNS THE MONEY ───────────────────┐
 * │ Unpaid leave and unauthorised absence are the two places where attendance  │
 * │ meets pay. Payroll must know how many such days there were; it must not     │
 * │ know how attendance is recorded, and Attendance must not know what a day    │
 * │ is worth. So Compensation declares the question and Attendance answers it. │
 * │                                                                            │
 * │ Note what this port does NOT return: a monetary amount. Attendance counts  │
 * │ days; Payroll prices them.                                                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
interface ProvidesAbsenceFacts
{
    /**
     * Deductible days for one employee across a window.
     *
     * @param  string  $from  inclusive Y-m-d
     * @param  string  $to  inclusive Y-m-d
     * @return array{
     *     unauthorized_absence_days: int,
     *     unpaid_leave_days: int,
     *     paid_leave_days: int,
     *     present_days: int,
     *     working_days_recorded: int
     * }
     */
    public function deductibleDaysFor(string $employeeId, string $from, string $to): array;
}
