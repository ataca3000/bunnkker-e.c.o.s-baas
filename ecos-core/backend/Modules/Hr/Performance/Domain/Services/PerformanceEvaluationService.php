<?php

declare(strict_types=1);

namespace Modules\Hr\Performance\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Hr\Compensation\Domain\Enums\KpiMetric;
use Modules\Hr\Performance\Domain\Enums\GoalSubject;
use Modules\Hr\Performance\Domain\Enums\PerformanceStatus;
use Modules\Hr\Performance\Domain\Models\Goal;
use Modules\Hr\Performance\Domain\Models\PerformanceSnapshot;

/**
 * Turning goals and measured facts into achievement.
 *
 * Recomputing a month replaces its snapshots rather than adding to them, so the
 * history stays one row per subject, metric and month — which is what makes the
 * trend line meaningful.
 */
final class PerformanceEvaluationService
{
    public function __construct(
        private readonly KpiEngine $kpi,
        private readonly GoalService $goals,
    ) {}

    /**
     * Evaluate one subject's goals for a month.
     *
     * @return array<int, PerformanceSnapshot>
     */
    public function evaluateSubject(string $companyId, GoalSubject $subject, string $subjectId, string $periodMonth): array
    {
        $snapshots = [];

        foreach ($this->goals->forSubject($companyId, $subject, $subjectId, $periodMonth) as $goal) {
            $snapshots[] = $this->evaluateGoal($goal);
        }

        return $snapshots;
    }

    /** Evaluate every goal set for a month, across the whole company. */
    public function evaluatePeriod(string $companyId, string $periodMonth): int
    {
        $goals = $this->goals->forPeriod($companyId, $periodMonth);

        foreach ($goals as $goal) {
            $this->evaluateGoal($goal);
        }

        return $goals->count();
    }

    /** Measure one goal and write its snapshot. */
    public function evaluateGoal(Goal $goal): PerformanceSnapshot
    {
        $measured = $this->kpi->actual(
            (string) $goal->company_id,
            $goal->subject_type,
            (string) $goal->subject_id,
            (string) $goal->metric_key,
            (string) $goal->period_month,
        );

        $actual = $measured['value'];
        $achievement = $goal->achievement($actual);
        $status = PerformanceStatus::fromAchievement($achievement);
        $metric = KpiMetric::tryFrom((string) $goal->metric_key);

        $snapshot = PerformanceSnapshot::updateOrCreate(
            [
                'company_id' => $goal->company_id,
                'subject_type' => $goal->subject_type->value,
                'subject_id' => $goal->subject_id,
                'metric_key' => $goal->metric_key,
                'period_month' => $goal->period_month,
            ],
            [
                'goal_id' => $goal->id,
                'target_value' => $goal->target_value,
                'actual_value' => $actual,
                'achievement_percent' => $achievement,
                'status' => $status->value,
                'fact_count' => $measured['facts'],
                'explanation' => [
                    'metric' => $goal->metric_key,
                    'metric_label' => $metric?->label(),
                    'source_module' => $metric?->sourceModule(),
                    'aggregation' => $measured['aggregation'],
                    'comparison' => $goal->comparison,
                    'target' => (float) $goal->target_value,
                    'actual' => $actual,
                    'facts_counted' => $measured['facts'],
                    'formula' => $goal->lowerIsBetter()
                        ? 'achievement = target ÷ actual × 100 (lower is better, capped at 200)'
                        : 'achievement = actual ÷ target × 100 (capped at 200)',
                    'achievement_percent' => $achievement,
                    'status' => $status->value,
                ],
                'computed_at' => Carbon::now(),
            ]
        );

        // Keep the goal's own status in step with what was measured.
        $goal->update([
            'status' => match (true) {
                $status->metTarget() => 'achieved',
                $status === PerformanceStatus::Missed => 'missed',
                default => 'active',
            },
        ]);

        return $snapshot;
    }

    /**
     * A subject's overall achievement for a month — the weighted average across
     * their goals, which is what a bonus recommendation is banded on.
     *
     * @return array<string, mixed>
     */
    public function overallAchievement(string $companyId, GoalSubject $subject, string $subjectId, string $periodMonth): array
    {
        $snapshots = PerformanceSnapshot::query()
            ->with('goal')
            ->where('company_id', $companyId)
            ->where('subject_type', $subject->value)
            ->where('subject_id', $subjectId)
            ->where('period_month', $periodMonth)
            ->get();

        if ($snapshots->isEmpty()) {
            return ['goals' => 0, 'achievement_percent' => 0.0, 'status' => PerformanceStatus::Missed->value, 'weighted' => false];
        }

        $totalWeight = 0;
        $weighted = 0.0;

        foreach ($snapshots as $snapshot) {
            $weight = max(1, (int) ($snapshot->goal->weight ?? 100));
            $totalWeight += $weight;
            $weighted += (float) $snapshot->achievement_percent * $weight;
        }

        $overall = round($weighted / max(1, $totalWeight), 2);

        return [
            'goals' => $snapshots->count(),
            'achievement_percent' => $overall,
            'status' => PerformanceStatus::fromAchievement($overall)->value,
            'weighted' => true,
            'met_targets' => $snapshots->filter(fn ($s) => $s->status->metTarget())->count(),
        ];
    }
}
