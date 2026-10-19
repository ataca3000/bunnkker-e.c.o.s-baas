<?php

declare(strict_types=1);

namespace Modules\Hr\Performance\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Hr\Compensation\Domain\Enums\KpiAggregation;
use Modules\Hr\Compensation\Domain\Enums\KpiMetric;
use Modules\Hr\Compensation\Domain\Services\KpiFactService;
use Modules\Hr\Performance\Domain\Enums\GoalSubject;

/**
 * The KPI engine — what a person or a department actually achieved.
 *
 * ┌─ COLLECTED, NOT TYPED IN ───────────────────────────────────────────────┐
 * │ Every number here is aggregated from the facts operational modules pushed  │
 * │ into the workforce stream. Nobody enters their own sales figure or their    │
 * │ own delivery count, which is the point: the measure and the measured are    │
 * │ different systems.                                                         │
 * │                                                                            │
 * │ Percentages are averaged and everything else is summed — a metric declares  │
 * │ which in the registry, so the engine never has to know what it is looking   │
 * │ at.                                                                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class KpiEngine
{
    public function __construct(private readonly KpiFactService $facts) {}

    /**
     * The measured actual for one subject, metric and month.
     *
     * @return array{value: float, quantity: float, facts: int, aggregation: string}
     */
    public function actual(string $companyId, GoalSubject $subject, string $subjectId, string $metricKey, string $periodMonth): array
    {
        [$from, $to] = $this->monthBounds($periodMonth);
        $column = $subject->factColumn();
        $metric = KpiMetric::tryFrom($metricKey);
        $aggregation = $metric?->aggregation() ?? KpiAggregation::Sum;

        $totals = $this->facts->aggregate($companyId, $column, $subjectId, $metricKey, $from, $to);

        // A count metric is measured by quantity; money and percentages by value.
        $isCount = $metric !== null && $metric->unit() === 'count';

        $value = match ($aggregation) {
            KpiAggregation::Average => $this->facts->average($companyId, $column, $subjectId, $metricKey, $from, $to),
            default => $isCount ? $totals['quantity'] : $totals['value'],
        };

        return [
            'value' => round($value, 4),
            'quantity' => $totals['quantity'],
            'facts' => $totals['facts'],
            'aggregation' => $aggregation->value,
        ];
    }

    /**
     * Every metric a subject has facts for in a month — what they did, whether or
     * not anyone set a goal for it.
     *
     * @return array<int, array<string, mixed>>
     */
    public function measuredMetrics(string $companyId, GoalSubject $subject, string $subjectId, string $periodMonth): array
    {
        [$from, $to] = $this->monthBounds($periodMonth);

        $rows = DB::table('hr_kpi_facts')
            ->where('company_id', $companyId)
            ->where($subject->factColumn(), $subjectId)
            ->whereBetween('occurred_at', [$from.' 00:00:00', $to.' 23:59:59'])
            ->groupBy('metric_key')
            ->selectRaw('metric_key, count(*) as facts')
            ->get();

        return $rows->map(function ($row) use ($companyId, $subject, $subjectId, $periodMonth) {
            $metric = KpiMetric::tryFrom((string) $row->metric_key);
            $actual = $this->actual($companyId, $subject, $subjectId, (string) $row->metric_key, $periodMonth);

            return [
                'metric_key' => (string) $row->metric_key,
                'label' => $metric?->label() ?? (string) $row->metric_key,
                'module' => $metric?->sourceModule(),
                'unit' => $metric?->unit() ?? 'count',
                'actual' => $actual['value'],
                'facts' => $actual['facts'],
            ];
        })->all();
    }

    /** The catalogue of metrics the engine can collect, for goal and rule builders. */
    public function catalogue(): array
    {
        return array_map(fn (KpiMetric $m) => [
            'key' => $m->value,
            'label' => $m->label(),
            'module' => $m->sourceModule(),
            'unit' => $m->unit(),
            'aggregation' => $m->aggregation()->value,
            'higher_is_better' => $m->higherIsBetter(),
        ], KpiMetric::cases());
    }

    /** @return array{0: string, 1: string} the first and last day of a YYYY-MM */
    public function monthBounds(string $periodMonth): array
    {
        $start = Carbon::parse($periodMonth.'-01')->startOfMonth();

        return [$start->toDateString(), $start->copy()->endOfMonth()->toDateString()];
    }
}
