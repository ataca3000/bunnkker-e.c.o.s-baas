<?php

declare(strict_types=1);

namespace Modules\Hr\Executive\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Modules\Hr\Executive\Domain\Services\HrAnalyticsService;
use Modules\Hr\Executive\Domain\Services\HrExecutiveDashboardService;
use Modules\Hr\Performance\Domain\Enums\GoalSubject;
use Modules\Hr\Performance\Domain\Services\PerformanceDashboardService;
use Modules\Hr\Workforce\Domain\Models\Department;
use Modules\Hr\Workforce\Domain\Models\Employee;
use Modules\Hr\Workforce\Domain\Services\Employee360Service;
use Modules\Hr\Workforce\Presentation\Http\Controllers\Concerns\ResolvesHrContext;

/**
 * The HR executive workspace — dashboards, analytics and drill-down.
 *
 * Read-only throughout: every route is a GET, and the services behind them own
 * no data. Drill-down reaches Employee 360 and the department view through the
 * services that own those, so an executive sees exactly what an operator sees.
 */
class HrExecutiveController extends Controller
{
    use ResolvesHrContext;

    public function __construct(
        private readonly HrExecutiveDashboardService $dashboard,
        private readonly HrAnalyticsService $analytics,
        private readonly Employee360Service $employee360,
        private readonly PerformanceDashboardService $performance,
    ) {}

    /** The whole picture on one page. */
    public function dashboard(Request $request): JsonResponse
    {
        $v = $request->validate(['date' => ['nullable', 'date']]);

        return response()->json([
            'data' => $this->dashboard->overview($this->companyId($request), $v['date'] ?? null),
        ]);
    }

    // ── Individual panels, for drill-down and interactive KPIs ────────────────

    public function workforce(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->dashboard->workforce($this->companyId($request))]);
    }

    public function attendance(Request $request): JsonResponse
    {
        $v = $request->validate(['date' => ['nullable', 'date']]);
        $day = Carbon::parse($v['date'] ?? Carbon::now()->toDateString());

        return response()->json(['data' => $this->dashboard->attendance($this->companyId($request), $day)]);
    }

    public function compensation(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->dashboard->compensation($this->companyId($request), $this->month($request)),
        ]);
    }

    public function performanceSummary(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->dashboard->performance($this->companyId($request), $this->month($request)),
        ]);
    }

    public function recruitment(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->dashboard->recruitment($this->companyId($request), $this->month($request)),
        ]);
    }

    public function operations(Request $request): JsonResponse
    {
        $v = $request->validate(['date' => ['nullable', 'date']]);
        $day = Carbon::parse($v['date'] ?? Carbon::now()->toDateString());

        return response()->json(['data' => $this->dashboard->operations($this->companyId($request), $day)]);
    }

    // ── Analytics ─────────────────────────────────────────────────────────────

    /** Every trend at once. */
    public function trends(Request $request): JsonResponse
    {
        $months = min(24, max(3, (int) $request->integer('months', 12)));

        return response()->json(['data' => $this->analytics->trends($this->companyId($request), $months)]);
    }

    /** One trend, for a chart that only needs the series it draws. */
    public function trend(Request $request, string $series): JsonResponse
    {
        $months = $this->analytics->months(min(24, max(3, (int) $request->integer('months', 12))));
        $companyId = $this->companyId($request);

        $data = match ($series) {
            'hiring' => $this->analytics->hiring($companyId, $months),
            'turnover' => $this->analytics->turnover($companyId, $months),
            'attendance' => $this->analytics->attendance($companyId, $months),
            'payroll' => $this->analytics->payroll($companyId, $months),
            'performance' => $this->analytics->performance($companyId, $months),
            'recruitment' => $this->analytics->recruitment($companyId, $months),
            'department-growth' => $this->analytics->departmentGrowth($companyId, $months),
            default => null,
        };

        if ($data === null) {
            return response()->json(['message' => 'Unknown analytics series.'], 404);
        }

        return response()->json(['data' => ['series' => $series, 'months' => $months, 'points' => $data]]);
    }

    // ── Drill-down ────────────────────────────────────────────────────────────

    /** A department, from the executive view down to its people. */
    public function department(Request $request, string $departmentId): JsonResponse
    {
        $companyId = $this->companyId($request);

        $department = Department::query()
            ->where('company_id', $companyId)->where('id', $departmentId)->firstOrFail();

        $employees = Employee::query()
            ->with(['position:id,title'])
            ->where('company_id', $companyId)
            ->where('department_id', $departmentId)
            ->whereNotIn('status', ['terminated', 'resigned'])
            ->orderBy('first_name')
            ->get();

        return response()->json([
            'data' => [
                'department' => ['id' => (string) $department->id, 'code' => $department->code, 'name' => $department->name],
                'headcount' => $employees->count(),
                'employees' => $employees->map(fn (Employee $e) => [
                    'id' => (string) $e->id,
                    'employee_number' => $e->employee_number,
                    'name' => $e->fullName(),
                    'position' => $e->position?->title,
                    'status' => $e->status->value,
                ])->all(),
                // The same view the department dashboard shows — one source, one answer.
                'performance' => $this->performance->forDepartment($companyId, $departmentId, $this->month($request)),
            ],
        ]);
    }

    /** A branch, broken down by department. */
    public function branch(Request $request, string $branchId): JsonResponse
    {
        $companyId = $this->companyId($request);

        $employees = Employee::query()
            ->with(['department:id,name', 'position:id,title'])
            ->where('company_id', $companyId)
            ->where('branch_id', $branchId)
            ->whereNotIn('status', ['terminated', 'resigned'])
            ->get();

        $byDepartment = $employees->groupBy(fn (Employee $e) => (string) ($e->department?->name ?? 'Unassigned'))
            ->map(fn ($group, $name) => ['department' => $name, 'employees' => $group->count()])
            ->values()->all();

        $today = Carbon::now()->startOfDay();
        $attendance = $this->dashboard->attendance($companyId, $today);

        return response()->json([
            'data' => [
                'branch_id' => $branchId,
                'headcount' => $employees->count(),
                'by_department' => $byDepartment,
                'by_status' => $employees->groupBy(fn (Employee $e) => $e->status->value)
                    ->map(fn ($g) => $g->count())->all(),
                // Company-wide attendance for context; the branch slice is the headcount above.
                'company_attendance_today' => $attendance,
            ],
        ]);
    }

    /** Employee 360, reached from the executive workspace. */
    public function employee(Request $request, string $employeeId): JsonResponse
    {
        $employee = $this->employee($request, $employeeId);

        return response()->json([
            'data' => [
                'overview' => $this->employee360->build($employee),
                'performance' => $this->performance->forEmployee($employee, $this->month($request)),
                'history' => $this->performance->history(
                    (string) $employee->company_id, GoalSubject::Employee, (string) $employee->id, 6
                ),
            ],
        ]);
    }

    private function month(Request $request): string
    {
        return $request->string('period_month', Carbon::now()->format('Y-m'))->toString();
    }
}
