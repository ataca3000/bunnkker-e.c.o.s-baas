<?php

declare(strict_types=1);

namespace Modules\Hr\Attendance\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Hr\Attendance\Domain\Enums\AttendanceStatus;

/**
 * Who is available today, company-wide and by department.
 *
 * The operational question this whole epic exists to answer: how many people can
 * work right now. Counted from the registered attendance days, with everyone not
 * yet registered reported honestly as unregistered rather than assumed present.
 */
final class WorkforceAvailabilityService
{
    public function __construct(private readonly HolidayService $holidays) {}

    /** @return array<string, mixed> */
    public function forDate(string $companyId, ?string $date = null): array
    {
        $day = Carbon::parse($date ?? Carbon::now()->toDateString())->startOfDay();

        $headcount = DB::table('hr_employees')
            ->where('company_id', $companyId)
            ->whereNull('deleted_at')
            ->whereNotIn('status', ['terminated', 'resigned'])
            ->count();

        $counts = $this->statusCounts($companyId, $day);
        $registered = (int) array_sum($counts);

        $present = $counts[AttendanceStatus::Present->value] ?? 0;
        $holiday = $this->holidays->holidayOn($companyId, $day);

        return [
            'date' => $day->toDateString(),
            'headcount' => $headcount,
            'registered' => $registered,
            'unregistered' => max(0, $headcount - $registered),
            'present' => $present,
            'absent' => $counts[AttendanceStatus::Absent->value] ?? 0,
            'on_leave' => $counts[AttendanceStatus::Leave->value] ?? 0,
            'holiday' => $counts[AttendanceStatus::Holiday->value] ?? 0,
            'rest_day' => $counts[AttendanceStatus::RestDay->value] ?? 0,
            'availability_percent' => $headcount > 0 ? round(($present / $headcount) * 100, 2) : 0.0,
            'registration_percent' => $headcount > 0 ? round(($registered / $headcount) * 100, 2) : 0.0,
            'official_holiday' => $holiday === null ? null : [
                'id' => $holiday->id, 'name' => $holiday->name, 'type' => $holiday->type->value,
            ],
        ];
    }

    /**
     * The same picture broken down by department — where the gaps actually are.
     *
     * @return array<int, array<string, mixed>>
     */
    public function byDepartment(string $companyId, ?string $date = null): array
    {
        $day = Carbon::parse($date ?? Carbon::now()->toDateString())->startOfDay();

        $headcounts = DB::table('hr_employees')
            ->where('company_id', $companyId)
            ->whereNull('deleted_at')
            ->whereNotIn('status', ['terminated', 'resigned'])
            ->groupBy('department_id')
            ->selectRaw('department_id, count(*) as total')
            ->pluck('total', 'department_id');

        $rows = DB::table('hr_attendance_days')
            ->where('company_id', $companyId)
            ->where('work_date', $day->toDateString())
            ->groupBy('department_id', 'status')
            ->selectRaw('department_id, status, count(*) as total')
            ->get();

        $departments = DB::table('hr_departments')
            ->where('company_id', $companyId)
            ->whereNull('deleted_at')
            ->pluck('name', 'id');

        $out = [];
        foreach ($headcounts as $departmentId => $headcount) {
            $key = $departmentId === null ? '' : (string) $departmentId;
            $counts = $rows->where('department_id', $departmentId)->pluck('total', 'status');
            $present = (int) ($counts[AttendanceStatus::Present->value] ?? 0);
            $registered = (int) $counts->sum();

            $out[] = [
                'department_id' => $departmentId,
                'department' => $key === '' ? 'Unassigned' : ($departments[$key] ?? 'Unknown'),
                'headcount' => (int) $headcount,
                'present' => $present,
                'absent' => (int) ($counts[AttendanceStatus::Absent->value] ?? 0),
                'on_leave' => (int) ($counts[AttendanceStatus::Leave->value] ?? 0),
                'holiday' => (int) ($counts[AttendanceStatus::Holiday->value] ?? 0),
                'rest_day' => (int) ($counts[AttendanceStatus::RestDay->value] ?? 0),
                'unregistered' => max(0, (int) $headcount - $registered),
                'availability_percent' => $headcount > 0 ? round(($present / (int) $headcount) * 100, 2) : 0.0,
            ];
        }

        usort($out, fn ($a, $b) => strcmp((string) $a['department'], (string) $b['department']));

        return $out;
    }

    /**
     * A department's attendance across a date range — the operational history
     * behind today's number.
     *
     * @return array<string, mixed>
     */
    public function departmentTrend(string $companyId, string $departmentId, string $from, string $to): array
    {
        $rows = DB::table('hr_attendance_days')
            ->where('company_id', $companyId)
            ->where('department_id', $departmentId)
            ->whereBetween('work_date', [$from, $to])
            ->groupBy('work_date', 'status')
            ->selectRaw('work_date, status, count(*) as total')
            ->orderBy('work_date')
            ->get();

        $series = [];
        foreach ($rows->groupBy('work_date') as $date => $dayRows) {
            $counts = $dayRows->pluck('total', 'status');
            $series[] = [
                'date' => (string) $date,
                'present' => (int) ($counts[AttendanceStatus::Present->value] ?? 0),
                'absent' => (int) ($counts[AttendanceStatus::Absent->value] ?? 0),
                'on_leave' => (int) ($counts[AttendanceStatus::Leave->value] ?? 0),
            ];
        }

        return [
            'department_id' => $departmentId,
            'from' => $from,
            'to' => $to,
            'series' => $series,
        ];
    }

    /** @return array<string, int> */
    private function statusCounts(string $companyId, Carbon $day): array
    {
        return DB::table('hr_attendance_days')
            ->where('company_id', $companyId)
            ->where('work_date', $day->toDateString())
            ->groupBy('status')
            ->selectRaw('status, count(*) as total')
            ->pluck('total', 'status')
            ->map(fn ($v) => (int) $v)
            ->all();
    }
}
