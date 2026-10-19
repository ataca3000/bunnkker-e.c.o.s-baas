<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Support\Collection;
use Modules\System\Engineering\Domain\Models\IntelInsight;
use Modules\System\Engineering\Domain\Models\IntelKnowledgeEntry;

/**
 * Engineering Insights Engine (TASK-ENG-V2-004).
 *
 * Applies a fixed rule set over analytics, trends, patterns, and debt to
 * produce human-readable insights with attached evidence. generate() is
 * idempotent for a given data state: unacknowledged generated insights
 * are replaced wholesale, so re-running against unchanged data yields
 * the same set. Acknowledged insights are preserved as history.
 */
class IntelInsightsEngine
{
    public function __construct(
        private readonly IntelAnalyticsEngine $analytics,
        private readonly IntelTrendEngine $trends,
        private readonly IntelPatternDetector $patterns,
        private readonly IntelDebtAnalyzer $debt,
    ) {}

    /**
     * Regenerate insights for a company. Returns the fresh set.
     *
     * @return Collection<int, IntelInsight>
     */
    public function generate(string $companyId): Collection
    {
        $candidates = array_merge(
            $this->rateDropInsights($companyId),
            $this->validatorHotspotInsights($companyId),
            $this->recurringRootCauseInsights($companyId),
            $this->debtInsights($companyId),
        );

        IntelInsight::query()
            ->where('company_id', $companyId)
            ->where('is_acknowledged', false)
            ->delete();

        $created = collect();

        foreach ($candidates as $candidate) {
            $created->push(IntelInsight::create(array_merge($candidate, [
                'company_id'   => $companyId,
                'generated_at' => now(),
            ])));
        }

        return $created;
    }

    /**
     * @return Collection<int, IntelInsight>
     */
    public function list(string $companyId, bool $includeAcknowledged = false): Collection
    {
        return IntelInsight::query()
            ->where('company_id', $companyId)
            ->when(! $includeAcknowledged, fn ($q) => $q->where('is_acknowledged', false))
            ->orderByRaw("CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END")
            ->orderByDesc('generated_at')
            ->get();
    }

    public function acknowledge(IntelInsight $insight, string $actorId): IntelInsight
    {
        $insight->update([
            'is_acknowledged' => true,
            'acknowledged_by' => $actorId,
            'acknowledged_at' => now(),
        ]);

        return $insight->fresh();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function rateDropInsights(string $companyId): array
    {
        $comparison = $this->trends->comparePeriods($companyId, 7);
        $insights   = [];

        $watched = [
            'repair_success_rate'    => 'Repair success rate',
            'validation_accept_rate' => 'Validation accept rate',
            'guardian_allow_rate'    => 'Guardian allow rate',
        ];

        foreach ($watched as $key => $label) {
            $delta = $comparison['deltas'][$key];

            if ($delta <= -10.0) {
                $insights[] = [
                    'insight_type' => 'rate_drop',
                    'severity'     => 'warning',
                    'title'        => "{$label} dropped " . abs($delta) . ' points week-over-week',
                    'description'  => "{$label} fell by " . abs($delta) . ' percentage points compared with the previous 7-day period. Review recent failures before the trend compounds.',
                    'evidence'     => ['metric' => $key, 'delta' => $delta, 'comparison' => $comparison['deltas']],
                ];
            }
        }

        return $insights;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function validatorHotspotInsights(string $companyId): array
    {
        $insights = [];

        foreach ($this->analytics->validatorReliability($companyId, 30) as $validator) {
            if ($validator['executed'] >= 5 && $validator['pass_rate'] < 50.0) {
                $insights[] = [
                    'insight_type' => 'validator_hotspot',
                    'severity'     => 'warning',
                    'title'        => "Validator '{$validator['validator']}' failing more than half of its runs",
                    'description'  => "The {$validator['validator']} validator passed only {$validator['pass_rate']}% of {$validator['executed']} executions in the last 30 days — the change stream is repeatedly violating what it checks.",
                    'evidence'     => $validator,
                ];
            }
        }

        return $insights;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function recurringRootCauseInsights(string $companyId): array
    {
        $insights = [];

        $entries = IntelKnowledgeEntry::query()
            ->where('company_id', $companyId)
            ->where('category', 'repair')
            ->where('occurrences', '>=', 3)
            ->where('confidence', '<', 50.0)
            ->orderByDesc('occurrences')
            ->limit(5)
            ->get();

        foreach ($entries as $entry) {
            $insights[] = [
                'insight_type' => 'recurring_root_cause',
                'severity'     => 'warning',
                'title'        => "Recurring low-confidence failure: {$entry->failure_type} / {$entry->root_cause}",
                'description'  => "This failure signature occurred {$entry->occurrences} times with a repair confidence of only {$entry->confidence}%. Repairs of this class are not sticking — a structural fix may be needed.",
                'evidence'     => [
                    'failure_type' => $entry->failure_type,
                    'root_cause'   => $entry->root_cause,
                    'occurrences'  => $entry->occurrences,
                    'confidence'   => $entry->confidence,
                ],
            ];
        }

        return $insights;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function debtInsights(string $companyId): array
    {
        $debt = $this->debt->analyze($companyId);

        if ($debt['debt_score'] < 60.0) {
            return [];
        }

        return [[
            'insight_type' => 'high_technical_debt',
            'severity'     => $debt['debt_score'] >= 80.0 ? 'critical' : 'warning',
            'title'        => "Technical debt score at {$debt['debt_score']} ({$debt['debt_level']})",
            'description'  => 'Accumulated engineering debt signals crossed the attention threshold. See the breakdown for the dominant contributors.',
            'evidence'     => $debt,
        ]];
    }
}
