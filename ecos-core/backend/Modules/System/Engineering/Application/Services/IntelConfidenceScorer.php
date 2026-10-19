<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Models\IntelKnowledgeEntry;

/**
 * Deterministic confidence formulas for the Engineering Intelligence
 * Platform (TASK-ENG-V2-004).
 *
 * Every score is a pure function of persisted history — same data in,
 * same score out. No randomness, no model inference.
 */
class IntelConfidenceScorer
{
    /**
     * Confidence (0-100) that a future repair of this failure signature
     * will succeed, based on the knowledge base track record.
     *
     * Formula: historical success rate damped by sample size — an entry
     * needs at least 5 observed outcomes for its rate to count in full.
     * With no history at all the score is a neutral 50.
     */
    public function repairConfidence(string $companyId, string $failureType, ?string $rootCause = null): float
    {
        $query = IntelKnowledgeEntry::query()
            ->where('company_id', $companyId)
            ->where('category', 'repair')
            ->where('failure_type', $failureType);

        if ($rootCause !== null) {
            $query->where('root_cause', $rootCause);
        }

        $entries = $query->get();

        $successes = (int) $entries->sum('success_count');
        $failures  = (int) $entries->sum('failure_count');
        $total     = $successes + $failures;

        if ($total === 0) {
            return 50.0;
        }

        $rate    = ($successes / $total) * 100.0;
        $damping = min(1.0, $total / 5.0);

        return round($rate * $damping + 50.0 * (1.0 - $damping), 2);
    }

    /**
     * Confidence (0-100) in a prediction derived from N observations.
     * Pure sample-size curve: 0 observations -> 0, 10+ -> 95 (never 100 —
     * predictions are extrapolations by definition).
     */
    public function predictionConfidence(int $observations): float
    {
        if ($observations <= 0) {
            return 0.0;
        }

        return round(min(95.0, $observations * 9.5), 2);
    }

    /**
     * Confidence (0-100) attached to a knowledge entry from its own counts.
     */
    public function entryConfidence(int $successCount, int $failureCount): float
    {
        $total = $successCount + $failureCount;

        if ($total === 0) {
            return 0.0;
        }

        $rate    = ($successCount / $total) * 100.0;
        $damping = min(1.0, $total / 5.0);

        return round($rate * $damping, 2);
    }
}
