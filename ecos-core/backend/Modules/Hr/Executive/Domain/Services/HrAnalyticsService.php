<?php

declare(strict_types=1);

namespace Modules\Hr\Executive\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Workforce trends — the same figures as the dashboard, across time.
 *
 * ┌─ MONTH BUCKETS · COUNTED, NOT MODELLED ─────────────────────────────────┐
 * │ Every series is a plain count or average per month. Nothing is smoothed,   │
 * │ extrapolated or forecast: a trend here is what happened, and a reader can   │
 * │ check any point against the underlying records.                            │
 * │                                                                            │
 * │ The month list is generated first and then filled, so a month with no       │
 * │ activity appears as a zero rather than vanishing from the chart — a gap and │
 * │ a zero mean very different things to someone reading a hiring trend.        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class HrAnalyticsService
{
    private const GONE = ['terminated', 'resigned'];

    /** @return array<string, mixed> */
    public function trends(string $companyId, int $months = 12): array
    {
        $buckets = $this->months($months);

        return [
            'months' => $buckets,
            'hiring' => $this->hiring($companyId, $buckets),
            'turnover' => $this->turnover($companyId, $buckets),
            'attendance' => $this->attendance($companyId, $buckets),
            'payroll' => $this->payroll($companyId, $buckets),
            'performance' => $this->performance($companyId, $buckets),
            'recruitment' => $this->recruitment($companyId, $buckets),
            'department_growth' => $this->departmentGrowth($companyId, $buckets),
        ];
    }

    // ── Hiring & turnover ─────────────────────────────────────────────────────

    /** @param array<int, string> $months @return array<int, array<string, mixed>> */
    public function hiring(string $companyId, array $months): array
    {
        $rows = DB::table('hr_employee_lifecycle_events')
            ->where('company_id', $companyId)
            ->whereIn('event_type', ['hired', 'rehired'])
            ->where('effective_date', '>=', $months[0].'-01')
            ->selectRaw('effective_date, count(*) as total')
            ->groupBy('effective_date')
            ->get();

        $byMonth = $this->bucketByDate($rows, 'effective_date', 'total');

        return array_map(fn (string $month) => [
            'month' => $month,
            'hires' => (int) ($byMonth[$month] ?? 0),
        ], $months);
    }

    /** @param array<int, string> $months @return array<int, array<string, mixed>> */
    public function turnover(string $companyId, array $months): array
    {
        $joins = $this->bucketByDate(
            DB::table('hr_employee_lifecycle_events')
                ->where('company_id', $companyId)->whereIn('event_type', ['hired', 'rehired'])
                ->where('effective_date', '>=', $months[0].'-01')
                ->selectRaw('effective_date, count(*) as total')->groupBy('effective_date')->get(),
            'effective_date', 'total'
        );

        $leaves = $this->bucketByDate(
            DB::table('hr_employee_lifecycle_events')
                ->where('company_id', $companyId)->whereIn('event_type', ['resigned', 'terminated'])
                ->where('effective_date', '>=', $months[0].'-01')
                ->selectRaw('effective_date, count(*) as total')->groupBy('effective_date')->get(),
            'effective_date', 'total'
        );

        // Headcount now, walked backwards through the movements, so each month's
        // rate is measured against the headcount that actually existed then.
        $headcount = DB::table('hr_employees')
            ->where('company_id', $companyId)->whereNull('deleted_at')
            ->whereNotIn('status', self::GONE)->count();

        $series = [];
        foreach (array_reverse($months) as $month) {
            $joiners = (int) ($joins[$month] ?? 0);
            $leavers = (int) ($leaves[$month] ?? 0);

            $series[] = [
                'month' => $month,
                'joiners' => $joiners,
                'leavers' => $leavers,
                'net_change' => $joiners - $leavers,
                'headcount' => $headcount,
                'turnover_rate_percent' => $headcount > 0 ? round(($leavers / $headcount) * 100, 2) : 0.0,
            ];

            $headcount = max(0, $headcount - $joiners + $leavers);
        }

        return array_reverse($series);
    }

    // ── Attendance ────────────────────────────────────────────────────────────

    /** @param array<int, string> $months @return array<int, array<string, mixed>> */
    public function attendance(string $companyId, array $months): array
    {
        $rows = DB::table('hr_attendance_days')
            ->where('company_id', $companyId)
            ->where('work_date', '>=', $months[0].'-01')
            ->selectRaw('work_date, status, count(*) as total')
            ->groupBy('work_date', 'status')
            ->get();

        $buckets = [];
        foreach ($rows as $row) {
            $month = substr((string) $row->work_date, 0, 7);
            $buckets[$month][$row->status] = ($buckets[$month][$row->status] ?? 0) + (int) $row->total;
        }

        return array_map(function (string $month) use ($buckets) {
            $counts = $buckets[$month] ?? [];
            $present = (int) ($counts['present'] ?? 0);
            $absent = (int) ($counts['absent'] ?? 0);
            $leave = (int) ($counts['leave'] ?? 0);
            $expected = $present + $absent + $leave;

            return [
                'month' => $month,
                'present' => $present,
                'absent' => $absent,
                'on_leave' => $leave,
                'attendance_rate_percent' => $expected > 0 ? round(($present / $expected) * 100, 2) : 0.0,
            ];
        }, $months);
    }

    // ── Payroll ───────────────────────────────────────────────────────────────

    /** @param array<int, string> $months @return array<int, array<string, mixed>> */
    public function payroll(string $companyId, array $months): array
    {
        $rows = DB::table('hr_payroll_runs')
            ->join('hr_payroll_periods', 'hr_payroll_periods.id', '=', 'hr_payroll_runs.payroll_period_id')
            ->where('hr_payroll_runs.company_id', $companyId)
            ->where('hr_payroll_runs.status', 'approved')
            ->select(
                'hr_payroll_periods.code as month',
                'hr_payroll_runs.total_net', 'hr_payroll_runs.total_gross',
                'hr_payroll_runs.total_bonus', 'hr_payroll_runs.total_commission',
                'hr_payroll_runs.total_deductions', 'hr_payroll_runs.employees_count'
            )
            ->get()
            ->keyBy('month');

        return array_map(fn (string $month) => [
            'month' => $month,
            'total_net' => round((float) ($rows[$month]->total_net ?? 0), 2),
            'total_gross' => round((float) ($rows[$month]->total_gross ?? 0), 2),
            'total_bonus' => round((float) ($rows[$month]->total_bonus ?? 0), 2),
            'total_commission' => round((float) ($rows[$month]->total_commission ?? 0), 2),
            'total_deductions' => round((float) ($rows[$month]->total_deductions ?? 0), 2),
            'employees_paid' => (int) ($rows[$month]->employees_count ?? 0),
        ], $months);
    }

    // ── Performance ───────────────────────────────────────────────────────────

    /** @param array<int, string> $months @return array<int, array<string, mixed>> */
    public function performance(string $companyId, array $months): array
    {
        $rows = DB::table('hr_performance_snapshots')
            ->where('company_id', $companyId)
            ->where('period_month', '>=', $months[0])
            ->groupBy('period_month')
            ->selectRaw('period_month, avg(achievement_percent) as achievement, count(*) as goals,
                sum(case when status in (\'achieved\', \'exceeded\') then 1 else 0 end) as met')
            ->get()
            ->keyBy('period_month');

        return array_map(function (string $month) use ($rows) {
            $row = $rows[$month] ?? null;
            $goals = (int) ($row->goals ?? 0);
            $met = (int) ($row->met ?? 0);

            return [
                'month' => $month,
                'goals' => $goals,
                'goals_met' => $met,
                'achievement_percent' => round((float) ($row->achievement ?? 0), 2),
                'goal_achievement_percent' => $goals > 0 ? round(($met / $goals) * 100, 2) : 0.0,
            ];
        }, $months);
    }

    // ── Recruitment ───────────────────────────────────────────────────────────

    /** @param array<int, string> $months @return array<int, array<string, mixed>> */
    public function recruitment(string $companyId, array $months): array
    {
        $applications = $this->bucketByDate(
            DB::table('hr_job_applications')
                ->where('company_id', $companyId)
                ->where('applied_at', '>=', $months[0].'-01 00:00:00')
                ->selectRaw('applied_at, count(*) as total')->groupBy('applied_at')->get(),
            'applied_at', 'total'
        );

        $hires = $this->bucketByDate(
            DB::table('hr_applicants')
                ->where('company_id', $companyId)->whereNotNull('hired_at')
                ->where('hired_at', '>=', $months[0].'-01 00:00:00')
                ->selectRaw('hired_at, count(*) as total')->groupBy('hired_at')->get(),
            'hired_at', 'total'
        );

        return array_map(function (string $month) use ($applications, $hires) {
            $applied = (int) ($applications[$month] ?? 0);
            $hired = (int) ($hires[$month] ?? 0);

            return [
                'month' => $month,
                'applications' => $applied,
                'hires' => $hired,
                'conversion_percent' => $applied > 0 ? round(($hired / $applied) * 100, 2) : 0.0,
            ];
        }, $months);
    }

    // ── Department growth ─────────────────────────────────────────────────────

    /**
     * How each department's headcount moved over the window — joiners and leavers
     * attributed to where the person sits now.
     *
     * @param  array<int, string>  $months
     * @return array<int, array<string, mixed>>
     */
    public function departmentGrowth(string $companyId, array $months): array
    {
        $current = DB::table('hr_employees')
            ->leftJoin('hr_departments', 'hr_departments.id', '=', 'hr_employees.department_id')
            ->where('hr_employees.company_id', $companyId)
            ->whereNull('hr_employees.deleted_at')
            ->whereNotIn('hr_employees.status', self::GONE)
            ->groupBy('hr_departments.id', 'hr_departments.name')
            ->selectRaw('hr_departments.id, hr_departments.name, count(*) as headcount')
            ->get();

        $movements = DB::table('hr_employee_lifecycle_events')
            ->join('hr_employees', 'hr_employees.id', '=', 'hr_employee_lifecycle_events.employee_id')
            ->where('hr_employee_lifecycle_events.company_id', $companyId)
            ->where('hr_employee_lifecycle_events.effective_date', '>=', $months[0].'-01')
            ->groupBy('hr_employees.department_id', 'hr_employee_lifecycle_events.event_type')
            ->selectRaw('hr_employees.department_id, hr_employee_lifecycle_events.event_type, count(*) as total')
            ->get();

        return $current->map(function ($row) use ($movements) {
            $mine = $movements->where('department_id', $row->id);
            $joiners = (int) $mine->whereIn('event_type', ['hired', 'rehired'])->sum('total');
            $leavers = (int) $mine->whereIn('event_type', ['resigned', 'terminated'])->sum('total');

            return [
                'department_id' => $row->id === null ? null : (string) $row->id,
                'name' => $row->name ?? 'Unassigned',
                'headcount' => (int) $row->headcount,
                'joiners' => $joiners,
                'leavers' => $leavers,
                'net_change' => $joiners - $leavers,
            ];
        })->sortByDesc('headcount')->values()->all();
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /**
     * The month labels, oldest first. Generated so an empty month reads as zero
     * rather than disappearing from the series.
     *
     * @return array<int, string>
     */
    public function months(int $count): array
    {
        $months = [];
        $cursor = Carbon::now()->startOfMonth()->subMonthsNoOverflow(max(1, $count) - 1);

        for ($i = 0; $i < max(1, $count); $i++) {
            $months[] = $cursor->format('Y-m');
            $cursor->addMonthNoOverflow();
        }

        return $months;
    }

    /**
     * Roll date-keyed rows up into YYYY-MM totals in PHP, which keeps the query
     * portable across database engines (date formatting is vendor-specific).
     *
     * @return array<string, int>
     */
    private function bucketByDate(iterable $rows, string $dateColumn, string $valueColumn): array
    {
        $buckets = [];

        foreach ($rows as $row) {
            $month = substr((string) $row->{$dateColumn}, 0, 7);
            $buckets[$month] = ($buckets[$month] ?? 0) + (int) $row->{$valueColumn};
        }

        return $buckets;
    }
}
