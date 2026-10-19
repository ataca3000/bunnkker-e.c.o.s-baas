<?php

declare(strict_types=1);

namespace Modules\Hr\Performance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Modules\Hr\Performance\Domain\Enums\GoalSubject;
use Modules\Hr\Performance\Domain\Models\Goal;
use Modules\Hr\Performance\Domain\Services\GoalService;
use Modules\Hr\Performance\Domain\Services\KpiEngine;
use Modules\Hr\Performance\Domain\Services\PerformanceDashboardService;
use Modules\Hr\Performance\Domain\Services\PerformanceEvaluationService;
use Modules\Hr\Workforce\Presentation\Http\Controllers\Concerns\ResolvesHrContext;

/** Goals, KPI evaluation and the performance dashboards. */
class PerformanceController extends Controller
{
    use ResolvesHrContext;

    public function __construct(
        private readonly GoalService $goals,
        private readonly KpiEngine $kpi,
        private readonly PerformanceEvaluationService $evaluation,
        private readonly PerformanceDashboardService $dashboards,
    ) {}

    private function month(Request $request): string
    {
        return $request->string('period_month', Carbon::now()->format('Y-m'))->toString();
    }

    // ── Goals ─────────────────────────────────────────────────────────────────

    public function goals(Request $request): JsonResponse
    {
        $subject = GoalSubject::tryFrom($request->string('subject_type', '')->toString());

        $rows = $this->goals->forPeriod($this->companyId($request), $this->month($request), $subject)
            ->map(fn (Goal $g) => $this->goalPayload($g));

        return response()->json(['data' => $rows]);
    }

    public function storeGoal(Request $request): JsonResponse
    {
        $v = $request->validate([
            'subject_type' => ['required', 'in:employee,department'],
            'subject_id' => ['required', 'string'],
            'metric_key' => ['required', 'string', 'max:60'],
            'target_value' => ['required', 'numeric'],
            'period_month' => ['required', 'string', 'regex:/^\d{4}-\d{2}$/'],
            'title' => ['nullable', 'string', 'max:200'],
            'comparison' => ['nullable', 'in:gte,lte'],
            'weight' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'notes' => ['nullable', 'string', 'max:400'],
        ]);

        $goal = $this->goals->set($this->companyId($request), $v, $this->actorId($request));

        return response()->json(['data' => $this->goalPayload($goal)], 201);
    }

    /** The metrics a goal can be set on — the same registry commission rules use. */
    public function metrics(): JsonResponse
    {
        return response()->json(['data' => $this->kpi->catalogue()]);
    }

    // ── Evaluation ────────────────────────────────────────────────────────────

    /** Measure every goal for a month against the collected facts. */
    public function evaluate(Request $request): JsonResponse
    {
        $month = $this->month($request);
        $count = $this->evaluation->evaluatePeriod($this->companyId($request), $month);

        return response()->json(['data' => ['period_month' => $month, 'goals_evaluated' => $count]]);
    }

    // ── Dashboards ────────────────────────────────────────────────────────────

    public function employeeDashboard(Request $request, string $employeeId): JsonResponse
    {
        $employee = $this->employee($request, $employeeId);

        return response()->json(['data' => $this->dashboards->forEmployee($employee, $this->month($request))]);
    }

    public function departmentDashboard(Request $request, string $departmentId): JsonResponse
    {
        return response()->json([
            'data' => $this->dashboards->forDepartment($this->companyId($request), $departmentId, $this->month($request)),
        ]);
    }

    public function history(Request $request, string $employeeId): JsonResponse
    {
        $employee = $this->employee($request, $employeeId);
        $months = min(24, max(1, (int) $request->integer('months', 6)));

        return response()->json([
            'data' => [
                'employee_id' => (string) $employee->id,
                'series' => $this->dashboards->history(
                    $this->companyId($request), GoalSubject::Employee, (string) $employee->id, $months
                ),
            ],
        ]);
    }

    /** @return array<string, mixed> */
    private function goalPayload(Goal $goal): array
    {
        return [
            'id' => (string) $goal->id,
            'subject_type' => $goal->subject_type->value,
            'subject_id' => (string) $goal->subject_id,
            'metric_key' => $goal->metric_key,
            'title' => $goal->title,
            'target_value' => round((float) $goal->target_value, 2),
            'comparison' => $goal->comparison,
            'lower_is_better' => $goal->lowerIsBetter(),
            'weight' => $goal->weight,
            'period_month' => $goal->period_month,
            'status' => $goal->status,
        ];
    }
}
