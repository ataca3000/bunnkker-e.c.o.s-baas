<?php

declare(strict_types=1);

namespace Modules\Hr\Executive\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The HR executive dashboard.
 *
 * ┌─ VISUALIZATION ONLY · NO BUSINESS OWNERSHIP ────────────────────────────┐
 * │ This context owns NOTHING. It has no tables, no models and no writes: it    │
 * │ reads what H1–H5 already decided and arranges it on one page. Every figure  │
 * │ here has an owner elsewhere, so the board's number and the operator's       │
 * │ number are the same number by construction rather than by agreement.        │
 * │                                                                            │
 * │ Reads go through query builders, never through write-capable models, which  │
 * │ is what makes "no business ownership" a property of the code rather than a  │
 * │ promise in a comment.                                                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class HrExecutiveDashboardService
{
    /** Statuses that mean someone has left. */
    private const GONE = ['terminated', 'resigned'];

    /** @return array<string, mixed> */
    public function overview(string $companyId, ?string $date = null): array
    {
        $day = Carbon::parse($date ?? Carbon::now()->toDateString())->startOfDay();
        $month = $day->format('Y-m');

        return [
            'date' => $day->toDateString(),
            'period_month' => $month,
            'workforce' => $this->workforce($companyId),
            'attendance' => $this->attendance($companyId, $day),
            'compensation' => $this->compensation($companyId, $month),
            'performance' => $this->performance($companyId, $month),
            'recruitment' => $this->recruitment($companyId, $month),
            'operations' => $this->operations($companyId, $day),
        ];
    }

    // ── Workforce ─────────────────────────────────────────────────────────────

    /** @return array<string, mixed> */
    public function workforce(string $companyId): array
    {
        $employed = fn () => DB::table('hr_employees')
            ->where('company_id', $companyId)
            ->whereNull('deleted_at')
            ->whereNotIn('status', self::GONE);

        return [
            'total_employees' => $employed()->count(),
            'by_status' => $employed()->groupBy('status')->selectRaw('status, count(*) as total')
                ->pluck('total', 'status')->map(fn ($v) => (int) $v)->all(),
            'by_company' => $this->byCompany(),
            'by_branch' => $this->countByJoin($companyId, 'branches', 'branch_id', 'name'),
            'by_department' => $this->countByJoin($companyId, 'hr_departments', 'department_id', 'name'),
            'by_position' => $this->countByJoin($companyId, 'hr_positions', 'position_id', 'title'),
        ];
    }

    // ── Attendance ────────────────────────────────────────────────────────────

    /** @return array<string, mixed> */
    public function attendance(string $companyId, Carbon $day): array
    {
        $counts = DB::table('hr_attendance_days')
            ->where('company_id', $companyId)
            ->where('work_date', $day->toDateString())
            ->groupBy('status')
            ->selectRaw('status, count(*) as total')
            ->pluck('total', 'status');

        $headcount = DB::table('hr_employees')
            ->where('company_id', $companyId)->whereNull('deleted_at')
            ->whereNotIn('status', self::GONE)->count();

        $registered = (int) $counts->sum();
        $present = (int) ($counts['present'] ?? 0);

        return [
            'headcount' => $headcount,
            'present' => $present,
            'absent' => (int) ($counts['absent'] ?? 0),
            'on_leave' => (int) ($counts['leave'] ?? 0),
            'holiday' => (int) ($counts['holiday'] ?? 0),
            'rest_day' => (int) ($counts['rest_day'] ?? 0),
            // Never assumed present — an unregistered day is reported as unknown.
            'unregistered' => max(0, $headcount - $registered),
            'attendance_rate_percent' => $headcount > 0 ? round(($present / $headcount) * 100, 2) : 0.0,
        ];
    }

    // ── Compensation ──────────────────────────────────────────────────────────

    /** @return array<string, mixed> */
    public function compensation(string $companyId, string $periodMonth): array
    {
        // The approved run for the month, if payroll has been signed off.
        $run = DB::table('hr_payroll_runs')
            ->join('hr_payroll_periods', 'hr_payroll_periods.id', '=', 'hr_payroll_runs.payroll_period_id')
            ->where('hr_payroll_runs.company_id', $companyId)
            ->where('hr_payroll_periods.code', $periodMonth)
            ->orderByRaw("case when hr_payroll_runs.status = 'approved' then 0 else 1 end")
            ->select('hr_payroll_runs.*')
            ->first();

        $outstandingAdvances = (float) DB::table('hr_advance_installments')
            ->where('company_id', $companyId)
            ->where('status', 'scheduled')
            ->sum('amount');

        return [
            'period_month' => $periodMonth,
            'has_run' => $run !== null,
            'run_status' => $run->status ?? null,
            'total_payroll' => round((float) ($run->total_net ?? 0), 2),
            'total_gross' => round((float) ($run->total_gross ?? 0), 2),
            'total_basic' => round((float) ($run->total_basic ?? 0), 2),
            'total_bonuses' => round((float) ($run->total_bonus ?? 0), 2),
            'total_commissions' => round((float) ($run->total_commission ?? 0), 2),
            'total_deductions' => round((float) ($run->total_deductions ?? 0), 2),
            'total_advances_recovered' => round((float) ($run->total_advances ?? 0), 2),
            'outstanding_advances' => round($outstandingAdvances, 2),
            'employees_paid' => (int) ($run->employees_count ?? 0),
            'pending_approvals' => [
                'bonuses' => DB::table('hr_bonuses')->where('company_id', $companyId)->where('status', 'pending')->count(),
                'deductions' => DB::table('hr_deductions')->where('company_id', $companyId)->where('status', 'pending')->count(),
                'advances' => DB::table('hr_advances')->where('company_id', $companyId)->where('status', 'pending')->count(),
            ],
        ];
    }

    // ── Performance ───────────────────────────────────────────────────────────

    /** @return array<string, mixed> */
    public function performance(string $companyId, string $periodMonth): array
    {
        $snapshots = DB::table('hr_performance_snapshots')
            ->where('company_id', $companyId)
            ->where('period_month', $periodMonth);

        $employeeRows = DB::table('hr_performance_snapshots')
            ->join('hr_employees', 'hr_employees.id', '=', 'hr_performance_snapshots.subject_id')
            ->where('hr_performance_snapshots.company_id', $companyId)
            ->where('hr_performance_snapshots.period_month', $periodMonth)
            ->where('hr_performance_snapshots.subject_type', 'employee')
            ->groupBy('hr_employees.id', 'hr_employees.first_name', 'hr_employees.last_name', 'hr_employees.employee_number')
            ->selectRaw('hr_employees.id, hr_employees.first_name, hr_employees.last_name, hr_employees.employee_number,
                avg(hr_performance_snapshots.achievement_percent) as achievement, count(*) as goals')
            ->orderByDesc('achievement')
            ->limit(10)
            ->get();

        $departmentRows = DB::table('hr_performance_snapshots')
            ->leftJoin('hr_departments', 'hr_departments.id', '=', 'hr_performance_snapshots.subject_id')
            ->where('hr_performance_snapshots.company_id', $companyId)
            ->where('hr_performance_snapshots.period_month', $periodMonth)
            ->where('hr_performance_snapshots.subject_type', 'department')
            ->groupBy('hr_departments.id', 'hr_departments.name')
            ->selectRaw('hr_departments.id, hr_departments.name,
                avg(hr_performance_snapshots.achievement_percent) as achievement, count(*) as goals')
            ->orderByDesc('achievement')
            ->get();

        $total = (clone $snapshots)->count();
        $met = (clone $snapshots)->whereIn('status', ['achieved', 'exceeded'])->count();

        return [
            'period_month' => $periodMonth,
            'goals_measured' => $total,
            'goals_met' => $met,
            'goal_achievement_percent' => $total > 0 ? round(($met / $total) * 100, 2) : 0.0,
            'average_achievement_percent' => round((float) ((clone $snapshots)->avg('achievement_percent') ?? 0), 2),
            'top_employees' => $employeeRows->map(fn ($r) => [
                'employee_id' => (string) $r->id,
                'employee_number' => $r->employee_number,
                'name' => trim(($r->first_name ?? '').' '.($r->last_name ?? '')),
                'achievement_percent' => round((float) $r->achievement, 2),
                'goals' => (int) $r->goals,
            ])->all(),
            'department_performance' => $departmentRows->map(fn ($r) => [
                'department_id' => $r->id === null ? null : (string) $r->id,
                'name' => $r->name ?? 'Unassigned',
                'achievement_percent' => round((float) $r->achievement, 2),
                'goals' => (int) $r->goals,
            ])->all(),
        ];
    }

    // ── Recruitment ───────────────────────────────────────────────────────────

    /** @return array<string, mixed> */
    public function recruitment(string $companyId, string $periodMonth): array
    {
        [$from, $to] = $this->monthBounds($periodMonth);

        $openJobs = DB::table('hr_job_openings')
            ->where('company_id', $companyId)->whereNull('deleted_at')
            ->where('status', 'published')->count();

        $applicationsThisMonth = DB::table('hr_job_applications')
            ->where('company_id', $companyId)
            ->whereBetween('applied_at', [$from.' 00:00:00', $to.' 23:59:59'])->count();

        $hiresThisMonth = DB::table('hr_applicants')
            ->where('company_id', $companyId)
            ->whereNotNull('hired_employee_id')
            ->whereBetween('hired_at', [$from.' 00:00:00', $to.' 23:59:59'])->count();

        // The funnel, read from the configured stages so it follows the pipeline.
        $funnel = DB::table('hr_recruitment_stages')
            ->leftJoin('hr_job_applications', function ($join): void {
                $join->on('hr_job_applications.current_stage_id', '=', 'hr_recruitment_stages.id')
                    ->whereIn('hr_job_applications.status', ['in_pipeline', 'hold', 'offer_sent', 'accepted']);
            })
            ->where('hr_recruitment_stages.company_id', $companyId)
            ->where('hr_recruitment_stages.is_active', true)
            ->groupBy('hr_recruitment_stages.id', 'hr_recruitment_stages.name', 'hr_recruitment_stages.sequence')
            ->selectRaw('hr_recruitment_stages.name, hr_recruitment_stages.sequence, count(hr_job_applications.id) as total')
            ->orderBy('hr_recruitment_stages.sequence')
            ->get();

        $totalApplications = DB::table('hr_job_applications')->where('company_id', $companyId)->count();
        $totalHires = DB::table('hr_applicants')->where('company_id', $companyId)->whereNotNull('hired_employee_id')->count();

        return [
            'period_month' => $periodMonth,
            'open_jobs' => $openJobs,
            'applications_this_month' => $applicationsThisMonth,
            'total_applications' => $totalApplications,
            'hires_this_month' => $hiresThisMonth,
            // What share of everyone who applied was eventually hired.
            'hiring_rate_percent' => $totalApplications > 0
                ? round(($totalHires / $totalApplications) * 100, 2)
                : 0.0,
            'talent_pool' => DB::table('hr_applicants')
                ->where('company_id', $companyId)->where('in_talent_pool', true)->count(),
            'interviews_upcoming' => DB::table('hr_interviews')
                ->where('company_id', $companyId)->where('status', 'scheduled')
                ->where('scheduled_at', '>=', Carbon::now())->count(),
            'funnel' => $funnel->map(fn ($r) => [
                'stage' => $r->name,
                'sequence' => (int) $r->sequence,
                'applications' => (int) $r->total,
            ])->all(),
        ];
    }

    // ── Operations ────────────────────────────────────────────────────────────

    /**
     * Who is actually available to work today, by the kind of work they do.
     *
     * Availability is department and position plus today's attendance — both HR's
     * own data. Shipping is not asked how many drivers it has; HR knows who its
     * drivers are and whether they turned up.
     *
     * @return array<string, mixed>
     */
    public function operations(string $companyId, Carbon $day): array
    {
        return [
            'date' => $day->toDateString(),
            'groups' => [
                $this->availability($companyId, $day, 'drivers', ['driver', 'courier', 'delivery']),
                $this->availability($companyId, $day, 'warehouse', ['warehouse', 'stock', 'inventory']),
                $this->availability($companyId, $day, 'preparation', ['preparation', 'picker', 'picking']),
                $this->availability($companyId, $day, 'packing', ['packing', 'packer']),
            ],
        ];
    }

    /**
     * One operational group's availability, matched on department or position name.
     *
     * @param  array<int, string>  $keywords
     * @return array<string, mixed>
     */
    private function availability(string $companyId, Carbon $day, string $group, array $keywords): array
    {
        $employees = DB::table('hr_employees')
            ->leftJoin('hr_departments', 'hr_departments.id', '=', 'hr_employees.department_id')
            ->leftJoin('hr_positions', 'hr_positions.id', '=', 'hr_employees.position_id')
            ->where('hr_employees.company_id', $companyId)
            ->whereNull('hr_employees.deleted_at')
            ->whereNotIn('hr_employees.status', self::GONE)
            ->where(function ($q) use ($keywords): void {
                foreach ($keywords as $keyword) {
                    $q->orWhereRaw('lower(hr_departments.name) like ?', ['%'.$keyword.'%'])
                        ->orWhereRaw('lower(hr_positions.title) like ?', ['%'.$keyword.'%']);
                }
            })
            ->pluck('hr_employees.id');

        if ($employees->isEmpty()) {
            return ['group' => $group, 'headcount' => 0, 'available' => 0, 'absent' => 0, 'on_leave' => 0, 'unregistered' => 0];
        }

        $counts = DB::table('hr_attendance_days')
            ->whereIn('employee_id', $employees)
            ->where('work_date', $day->toDateString())
            ->groupBy('status')
            ->selectRaw('status, count(*) as total')
            ->pluck('total', 'status');

        $registered = (int) $counts->sum();

        return [
            'group' => $group,
            'headcount' => $employees->count(),
            'available' => (int) ($counts['present'] ?? 0),
            'absent' => (int) ($counts['absent'] ?? 0),
            'on_leave' => (int) ($counts['leave'] ?? 0),
            'unregistered' => max(0, $employees->count() - $registered),
        ];
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /** @return array<int, array<string, mixed>> */
    private function byCompany(): array
    {
        return DB::table('hr_employees')
            ->join('companies', 'companies.id', '=', 'hr_employees.company_id')
            ->whereNull('hr_employees.deleted_at')
            ->whereNotIn('hr_employees.status', self::GONE)
            ->groupBy('companies.id', 'companies.name')
            ->selectRaw('companies.id, companies.name, count(*) as total')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($r) => ['id' => (string) $r->id, 'name' => $r->name, 'employees' => (int) $r->total])
            ->all();
    }

    /** @return array<int, array<string, mixed>> */
    private function countByJoin(string $companyId, string $table, string $foreignKey, string $labelColumn): array
    {
        return DB::table('hr_employees')
            ->leftJoin($table, $table.'.id', '=', 'hr_employees.'.$foreignKey)
            ->where('hr_employees.company_id', $companyId)
            ->whereNull('hr_employees.deleted_at')
            ->whereNotIn('hr_employees.status', self::GONE)
            ->groupBy($table.'.id', $table.'.'.$labelColumn)
            ->selectRaw($table.'.id, '.$table.'.'.$labelColumn.' as label, count(*) as total')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id === null ? null : (string) $r->id,
                'name' => $r->label ?? 'Unassigned',
                'employees' => (int) $r->total,
            ])->all();
    }

    /** @return array{0: string, 1: string} */
    private function monthBounds(string $periodMonth): array
    {
        $start = Carbon::parse($periodMonth.'-01')->startOfMonth();

        return [$start->toDateString(), $start->copy()->endOfMonth()->toDateString()];
    }
}
