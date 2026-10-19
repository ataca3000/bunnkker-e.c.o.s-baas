<?php

declare(strict_types=1);

namespace Modules\Hr\Attendance\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Hr\Attendance\Domain\Enums\AttendanceStatus;
use Modules\Hr\Workforce\Domain\Contracts\ProvidesAttendanceSummary;

/**
 * The H2 side of the Employee 360 port.
 *
 * Workforce asks for a person's recent attendance without knowing this class
 * exists; Attendance answers, because attendance events are its to own. One
 * grouped query, no per-day reads.
 */
final class AttendanceSummaryProvider implements ProvidesAttendanceSummary
{
    /** @return array<string, mixed> */
    public function summaryFor(string $employeeId, string $from, string $to): array
    {
        $counts = DB::table('hr_attendance_days')
            ->where('employee_id', $employeeId)
            ->whereBetween('work_date', [$from, $to])
            ->groupBy('status')
            ->selectRaw('status, count(*) as total')
            ->pluck('total', 'status');

        $present = (int) ($counts[AttendanceStatus::Present->value] ?? 0);
        $absent = (int) ($counts[AttendanceStatus::Absent->value] ?? 0);
        $leave = (int) ($counts[AttendanceStatus::Leave->value] ?? 0);
        $expected = $present + $absent + $leave;

        return [
            'from' => $from,
            'to' => $to,
            'registered_days' => (int) $counts->sum(),
            'present' => $present,
            'absent' => $absent,
            'on_leave' => $leave,
            'holiday' => (int) ($counts[AttendanceStatus::Holiday->value] ?? 0),
            'rest_day' => (int) ($counts[AttendanceStatus::RestDay->value] ?? 0),
            // Share of the days this person was expected that they actually worked.
            'attendance_rate_percent' => $expected > 0 ? round(($present / $expected) * 100, 2) : 0.0,
        ];
    }
}
