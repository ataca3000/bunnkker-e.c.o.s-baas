<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Domain\Services;

use Modules\Crm\Intelligence\Domain\Enums\RfmSegment;

/**
 * Recency / Frequency / Monetary scoring — deterministic quintiles.
 *
 * Each raw value is scored 1..5 by its rank within the company cohort (quintiles).
 * The scoring is a pure function of the cohort distribution: same values in, same
 * scores out. Recency is inverted (fewer days since last purchase = better).
 */
final class RfmAnalysisService
{
    /**
     * Score a value 1..5 against a cohort distribution.
     *
     * @param  float  $value  the customer's raw value
     * @param  array<int, float>  $cohort  every customer's value for this dimension
     * @param  bool  $higherIsBetter  true for frequency/monetary, false for recency-days
     */
    public function score(float $value, array $cohort, bool $higherIsBetter): int
    {
        $cohort = array_values(array_filter($cohort, static fn ($v) => $v !== null));
        if (count($cohort) <= 1) {
            return 3; // no spread to rank against — neutral middle score
        }

        sort($cohort);
        $n = count($cohort);

        // Fraction of the cohort at or below this value (0..1).
        $below = 0;
        foreach ($cohort as $v) {
            if ($v < $value) {
                $below++;
            }
        }
        $equal = 0;
        foreach ($cohort as $v) {
            if ($v === $value) {
                $equal++;
            }
        }
        // Mid-rank percentile so ties land in the same bucket deterministically.
        $percentile = ($below + ($equal / 2)) / $n;

        // Quintile 1..5.
        $bucket = (int) floor($percentile * 5) + 1;
        $bucket = max(1, min(5, $bucket));

        // For recency, a high "days since" value is bad → invert.
        return $higherIsBetter ? $bucket : 6 - $bucket;
    }

    /**
     * Score one customer across all three dimensions and derive the segment.
     *
     * @param  array{recency_days: ?int, frequency: int, monetary: float}  $customer
     * @param  array{recency: array<int, float>, frequency: array<int, float>, monetary: array<int, float>}  $cohort
     * @return array<string, mixed>
     */
    public function evaluate(array $customer, array $cohort): array
    {
        $recencyValue = (float) ($customer['recency_days'] ?? 0);
        $rScore = $this->score($recencyValue, $cohort['recency'], higherIsBetter: false);
        $fScore = $this->score((float) $customer['frequency'], $cohort['frequency'], higherIsBetter: true);
        $mScore = $this->score((float) $customer['monetary'], $cohort['monetary'], higherIsBetter: true);

        $fmScore = (int) round(($fScore + $mScore) / 2);
        $segment = RfmSegment::fromScores($rScore, $fmScore);

        return [
            'recency_score' => $rScore,
            'frequency_score' => $fScore,
            'monetary_score' => $mScore,
            'fm_score' => $fmScore,
            'segment' => $segment,
            'explanation' => [
                'r' => $rScore, 'f' => $fScore, 'm' => $mScore, 'fm' => $fmScore,
                'method' => 'quintile rank within company cohort; recency inverted',
                'cohort_size' => count($cohort['frequency']),
            ],
        ];
    }
}
