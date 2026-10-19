<?php

declare(strict_types=1);

namespace Modules\Hr\Performance\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Hr\Compensation\Domain\Enums\KpiMetric;
use Modules\Hr\Performance\Domain\Enums\GoalSubject;
use Modules\Hr\Performance\Domain\Enums\PerformanceStatus;
use Modules\Hr\Performance\Domain\Models\ManagerReview;
use Modules\Hr\Performance\Domain\Models\PerformanceSnapshot;
use Modules\Hr\Workforce\Domain\Models\Employee;

/**
 * The employee and department performance dashboards, and the history behind them.
 *
 * Target, actual, achievement and status per goal; team performance and rankings
 * for a department. Everything is read from the snapshots, so a dashboard and a
 * bonus recommendation can never disagree about the same month.
 */
final class PerformanceDashboardService
{
    public function __construct(
        private readonly KpiEngine $kpi,
        private readonly PerformanceEvaluationService $evaluation,
    ) {}

    /** @return array<string, mixed> */
    public function forEmployee(Employee $employee, string $periodMonth): array
    {
        $companyId = (string) $employee->company_id;
        $subjectId = (string) $employee->id;

        $snapshots = $this->snapshots($companyId, GoalSubject::Employee, $subjectId, $periodMonth);
        $overall = $this->evaluation->overallAchievement($companyId, GoalSubject::Employee, $subjectId, $periodMonth);

        $review = ManagerReview::query()
            ->where('company_id', $companyId)
            ->where('employee_id', $subjectId)
            ->where('period_month', $periodMonth)
            ->first();

        return [
            'employee' => [
                'id' => $subjectId,
                'employee_number' => $employee->employee_number,
                'name' => $employee->fullName(),
                'department_id' => $employee->department_id,
            ],
            'period_month' => $periodMonth,
            'overall' => $overall,
            'goals' => $snapshots,
            // What was measured even where nobody set a target.
            'measured_metrics' => $this->kpi->measuredMetrics($companyId, GoalSubject::Employee, $subjectId, $periodMonth),
            'review' => $review === null ? null : [
                'overall_rating' => $review->overall_rating,
                'strengths' => $review->strengths,
                'improvement_notes' => $review->improvement_notes,
                'manager_comments' => $review->manager_comments,
                'status' => $review->status,
            ],
            'history' => $this->history($companyId, GoalSubject::Employee, $subjectId, 6),
        ];
    }

    /** @return array<string, mixed> */
    public function forDepartment(string $companyId, string $departmentId, string $periodMonth): array
    {
        $departmentGoals = $this->snapshots($companyId, GoalSubject::Department, $departmentId, $periodMonth);
        $overall = $this->evaluation->overallAchievement($companyId, GoalSubject::Department, $departmentId, $periodMonth);

        $employees = Employee::query()
            ->where('company_id', $companyId)
            ->where('department_id', $departmentId)
            ->whereNotIn('status', ['terminated', 'resigned'])
            ->get();

        // One ranking row per member, from their own snapshots.
        $ranking = $employees->map(function (Employee $employee) use ($companyId, $periodMonth) {
            $result = $this->evaluation->overallAchievement(
                $companyId, GoalSubject::Employee, (string) $employee->id, $periodMonth
            );

            return [
                'employee_id' => (string) $employee->id,
                'employee_number' => $employee->employee_number,
                'name' => $employee->fullName(),
                'goals' => $result['goals'],
                'achievement_percent' => $result['achievement_percent'],
                'status' => $result['status'],
            ];
        })
            ->sortByDesc('achievement_percent')
            ->values()
            ->map(function (array $row, int $index) {
                $row['rank'] = $index + 1;

                return $row;
            })->all();

        $withGoals = array_values(array_filter($ranking, fn (array $r) => $r['goals'] > 0));
        $teamAverage = $withGoals === []
            ? 0.0
            : round(array_sum(array_column($withGoals, 'achievement_percent')) / count($withGoals), 2);

        return [
            'department_id' => $departmentId,
            'period_month' => $periodMonth,
            'department_goals' => $departmentGoals,
            'department_overall' => $overall,
            'team' => [
                'headcount' => $employees->count(),
                'with_goals' => count($withGoals),
                'average_achievement_percent' => $teamAverage,
                'status' => PerformanceStatus::fromAchievement($teamAverage)->value,
                'meeting_target' => count(array_filter(
                    $withGoals,
                    fn (array $r) => PerformanceStatus::from($r['status'])->metTarget()
                )),
                'needing_attention' => count(array_filter(
                    $withGoals,
                    fn (array $r) => PerformanceStatus::from($r['status'])->needsAttention()
                )),
            ],
            'rankings' => $ranking,
            'history' => $this->history($companyId, GoalSubject::Department, $departmentId, 6),
        ];
    }

    /**
     * Monthly achievement over time — the trend line.
     *
     * @return array<int, array<string, mixed>>
     */
    public function history(string $companyId, GoalSubject $subject, string $subjectId, int $months = 6): array
    {
        $earliest = Carbon::now()->subMonthsNoOverflow($months - 1)->format('Y-m');

        $rows = DB::table('hr_performance_snapshots')
            ->where('company_id', $companyId)
            ->where('subject_type', $subject->value)
            ->where('subject_id', $subjectId)
            ->where('period_month', '>=', $earliest)
            ->groupBy('period_month')
            ->selectRaw('period_month, avg(achievement_percent) as achievement, count(*) as goals')
            ->orderBy('period_month')
            ->get();

        return $rows->map(fn ($row) => [
            'period_month' => (string) $row->period_month,
            'achievement_percent' => round((float) $row->achievement, 2),
            'goals' => (int) $row->goals,
            'status' => PerformanceStatus::fromAchievement(round((float) $row->achievement, 2))->value,
        ])->all();
    }

    /** @return array<int, array<string, mixed>> */
    private function snapshots(string $companyId, GoalSubject $subject, string $subjectId, string $periodMonth): array
    {
        return PerformanceSnapshot::query()
            ->where('company_id', $companyId)
            ->where('subject_type', $subject->value)
            ->where('subject_id', $subjectId)
            ->where('period_month', $periodMonth)
            ->orderBy('metric_key')
            ->get()
            ->map(function (PerformanceSnapshot $snapshot) {
                $metric = KpiMetric::tryFrom((string) $snapshot->metric_key);

                return [
                    'metric_key' => $snapshot->metric_key,
                    'label' => $metric?->label() ?? $snapshot->metric_key,
                    'unit' => $metric?->unit() ?? 'count',
                    'module' => $metric?->sourceModule(),
                    'target' => round((float) $snapshot->target_value, 2),
                    'actual' => round((float) $snapshot->actual_value, 2),
                    'achievement_percent' => (float) $snapshot->achievement_percent,
                    'status' => $snapshot->status->value,
                    'status_label' => $snapshot->status->label(),
                    'facts' => $snapshot->fact_count,
                ];
            })->all();
    }
}
