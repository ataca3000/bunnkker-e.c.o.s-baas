<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Models\RepairSession;

/**
 * Failure Prediction Engine (TASK-ENG-V2-004).
 *
 * Predicts future engineering risks per failure type from historical
 * failure share and recurrence volume. The formula is fixed and
 * deterministic:
 *
 *   risk = failure_share * 60 + min(1, occurrences / 10) * 40
 *
 * Predictions are advisory only; nothing in the platform acts on them.
 */
class IntelPredictionEngine
{
    public function __construct(
        private readonly IntelConfidenceScorer $scorer,
        private readonly IntelPatternDetector $patternDetector,
    ) {}

    /**
     * Ranked engineering risk predictions for the coming period, derived
     * from the trailing window.
     *
     * @return array<int, array<string, mixed>>
     */
    public function predictRisks(string $companyId, int $days = 90): array
    {
        $rows = RepairSession::query()
            ->toBase()
            ->selectRaw(
                'failure_type, COUNT(*) AS occurrences, '
                . "SUM(CASE WHEN status IN ('failed', 'timeout') THEN 1 ELSE 0 END) AS failures"
            )
            ->where('company_id', $companyId)
            ->where('created_at', '>=', now()->subDays($days))
            ->groupBy('failure_type')
            ->get();

        $patterns = $this->patternDetector->detect($companyId, $days);

        $predictions = $rows->map(function ($row) use ($companyId, $patterns): array {
            $occurrences  = (int) $row->occurrences;
            $failures     = (int) $row->failures;
            $failureShare = $occurrences > 0 ? $failures / $occurrences : 0.0;

            $riskScore = round($failureShare * 60.0 + min(1.0, $occurrences / 10.0) * 40.0, 2);

            $relatedRootCauses = array_values(array_filter(
                $patterns['recurring_problems'],
                static fn (array $p): bool => $p['failure_type'] === $row->failure_type,
            ));

            return [
                'failure_type'        => $row->failure_type,
                'risk_score'          => $riskScore,
                'risk_level'          => $this->riskLevel($riskScore),
                'occurrences'         => $occurrences,
                'failures'            => $failures,
                'confidence'          => $this->scorer->predictionConfidence($occurrences),
                'repair_confidence'   => $this->scorer->repairConfidence($companyId, (string) $row->failure_type),
                'related_root_causes' => $relatedRootCauses,
            ];
        });

        return $predictions
            ->sortByDesc('risk_score')
            ->values()
            ->all();
    }

    private function riskLevel(float $score): string
    {
        return match (true) {
            $score >= 70.0 => 'high',
            $score >= 40.0 => 'medium',
            default        => 'low',
        };
    }
}
