<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Domain\Contracts;

/**
 * The port through which Employee 360 asks about attendance.
 *
 * ┌─ H1 DEFINES THE QUESTION · H2 OWNS THE ANSWER ──────────────────────────┐
 * │ The Employee 360 workspace shows a person's recent attendance, but the      │
 * │ workforce domain must not calculate it — attendance events belong to the    │
 * │ Attendance context. So H1 declares the shape of the answer it needs and H2  │
 * │ implements it. The dependency points inward: Workforce never names          │
 * │ Attendance, and Attendance can be replaced without touching the employee    │
 * │ master.                                                                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
interface ProvidesAttendanceSummary
{
    /**
     * A count of each attendance outcome for one employee across a date range.
     *
     * @param  string  $from  inclusive Y-m-d
     * @param  string  $to  inclusive Y-m-d
     * @return array<string, mixed>
     */
    public function summaryFor(string $employeeId, string $from, string $to): array;
}
