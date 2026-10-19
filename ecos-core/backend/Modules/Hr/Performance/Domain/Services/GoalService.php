<?php

declare(strict_types=1);

namespace Modules\Hr\Performance\Domain\Services;

use Modules\Hr\Compensation\Domain\Enums\KpiMetric;
use Modules\Hr\Compensation\Domain\Exceptions\CompensationException;
use Modules\Hr\Performance\Domain\Enums\GoalSubject;
use Modules\Hr\Performance\Domain\Models\Goal;

/**
 * Setting measurable targets.
 *
 * A goal must name a metric the KPI engine can actually collect — otherwise it
 * would sit there forever at zero achievement with nobody able to say why.
 */
final class GoalService
{
    public function set(string $companyId, array $data, ?int $actorId = null): Goal
    {
        $metric = KpiMetric::tryFrom((string) ($data['metric_key'] ?? ''));

        if ($metric === null) {
            throw CompensationException::unknownMetric((string) ($data['metric_key'] ?? ''));
        }

        $subject = ($data['subject_type'] ?? null) instanceof GoalSubject
            ? $data['subject_type']
            : (GoalSubject::tryFrom((string) ($data['subject_type'] ?? '')) ?? GoalSubject::Employee);

        // A metric where less is better defaults to the matching comparison, so
        // nobody accidentally sets a target to maximise their shortages.
        $comparison = $data['comparison'] ?? ($metric->higherIsBetter() ? 'gte' : 'lte');

        return Goal::updateOrCreate(
            [
                'company_id' => $companyId,
                'subject_type' => $subject->value,
                'subject_id' => $data['subject_id'],
                'metric_key' => $metric->value,
                'period_month' => $data['period_month'],
            ],
            [
                'title' => $data['title'] ?? $metric->label(),
                'target_value' => round((float) $data['target_value'], 4),
                'comparison' => $comparison,
                'weight' => (int) ($data['weight'] ?? 100),
                'status' => $data['status'] ?? 'active',
                'notes' => $data['notes'] ?? null,
                'created_by' => $actorId,
            ]
        );
    }

    /** @return \Illuminate\Database\Eloquent\Collection<int, Goal> */
    public function forSubject(string $companyId, GoalSubject $subject, string $subjectId, string $periodMonth)
    {
        return Goal::query()
            ->where('company_id', $companyId)
            ->where('subject_type', $subject->value)
            ->where('subject_id', $subjectId)
            ->where('period_month', $periodMonth)
            ->orderBy('metric_key')
            ->get();
    }

    /** @return \Illuminate\Database\Eloquent\Collection<int, Goal> */
    public function forPeriod(string $companyId, string $periodMonth, ?GoalSubject $subject = null)
    {
        return Goal::query()
            ->where('company_id', $companyId)
            ->where('period_month', $periodMonth)
            ->when($subject !== null, fn ($q) => $q->where('subject_type', $subject->value))
            ->orderBy('subject_type')
            ->get();
    }

    public function cancel(Goal $goal): Goal
    {
        $goal->update(['status' => 'cancelled']);

        return $goal->refresh();
    }
}
