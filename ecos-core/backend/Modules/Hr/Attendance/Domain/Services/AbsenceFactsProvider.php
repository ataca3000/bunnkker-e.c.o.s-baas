<?php

declare(strict_types=1);

namespace Modules\Hr\Attendance\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Hr\Attendance\Domain\Enums\AttendanceStatus;
use Modules\Hr\Attendance\Domain\Enums\LeavePayrollFlag;
use Modules\Hr\Compensation\Domain\Contracts\ProvidesAbsenceFacts;

/**
 * The Attendance side of the compensation port.
 *
 * It counts days and nothing more — what a day is worth is Payroll's business.
 * Leave is split by the payroll flag the manager set when approving it, which is
 * the whole reason that flag exists.
 */
final class AbsenceFactsProvider implements ProvidesAbsenceFacts
{
    /** @return array<string, int> */
    public function deductibleDaysFor(string $employeeId, string $from, string $to): array
    {
        $window = [$from, $to];

        $counts = DB::table('hr_attendance_days')
            ->where('employee_id', $employeeId)
            ->whereBetween('work_date', $window)
            ->groupBy('status')
            ->selectRaw('status, count(*) as total')
            ->pluck('total', 'status');

        // Leave days are only deductible when the approving manager said so.
        $leaveDays = DB::table('hr_attendance_days')
            ->join('hr_leave_requests', 'hr_leave_requests.id', '=', 'hr_attendance_days.leave_request_id')
            ->where('hr_attendance_days.employee_id', $employeeId)
            ->whereBetween('hr_attendance_days.work_date', $window)
            ->groupBy('hr_leave_requests.payroll_flag')
            ->selectRaw('hr_leave_requests.payroll_flag as flag, count(*) as total')
            ->pluck('total', 'flag');

        return [
            'unauthorized_absence_days' => (int) ($counts[AttendanceStatus::Absent->value] ?? 0),
            'unpaid_leave_days' => (int) ($leaveDays[LeavePayrollFlag::DeductSalary->value] ?? 0),
            'paid_leave_days' => (int) ($leaveDays[LeavePayrollFlag::DoNotDeductSalary->value] ?? 0),
            'present_days' => (int) ($counts[AttendanceStatus::Present->value] ?? 0),
            'working_days_recorded' => (int) ($counts[AttendanceStatus::Present->value] ?? 0)
                + (int) ($counts[AttendanceStatus::Absent->value] ?? 0)
                + (int) ($counts[AttendanceStatus::Leave->value] ?? 0),
        ];
    }
}
