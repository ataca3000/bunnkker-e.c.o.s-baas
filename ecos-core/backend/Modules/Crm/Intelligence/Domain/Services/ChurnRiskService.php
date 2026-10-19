<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Domain\Services;

use Modules\Crm\Intelligence\Domain\Enums\ChurnRiskBand;
use Modules\Crm\Intelligence\Domain\Support\IntelligenceWeights;

/**
 * Deterministic churn risk — overdue-ness against the customer's own cadence.
 *
 * A customer is "overdue" when the days since their last purchase exceed their
 * typical interval between purchases. Risk scales linearly with that ratio and
 * saturates at a configured multiple of the cadence. Single-purchase customers
 * are measured against a fixed baseline. The full ratio is returned so the score
 * is explainable, never a black box.
 */
final class ChurnRiskService
{
    /**
     * @param  array<string, mixed>  $aggregates  from PurchaseFactService::aggregates()
     * @return array<string, mixed>
     */
    public function evaluate(array $aggregates): array
    {
        $orders = (int) $aggregates['frequency'];

        if ($orders === 0) {
            return $this->result(100, null, null, null, 'no purchases on record');
        }

        $recency = (int) $aggregates['recency_days'];
        $expectedInterval = $aggregates['avg_interval_days'] !== null
            ? (int) $aggregates['avg_interval_days']
            : IntelligenceWeights::CHURN_SINGLE_ORDER_BASELINE_DAYS;
        $expectedInterval = max(1, $expectedInterval);

        $ratio = round($recency / $expectedInterval, 3);
        $cap = IntelligenceWeights::CHURN_OVERDUE_CAP_RATIO;

        $score = (int) round(min(100.0, ($ratio / $cap) * 100.0));
        $score = max(0, min(100, $score));

        $basis = $aggregates['avg_interval_days'] !== null ? 'observed cadence' : 'single-order baseline';

        return $this->result($score, $ratio, $recency, $expectedInterval, $basis);
    }

    private function result(int $score, ?float $ratio, ?int $recency, ?int $interval, string $basis): array
    {
        $band = ChurnRiskBand::fromScore($score);

        return [
            'score' => $score,
            'band' => $band,
            'explanation' => [
                'days_since_last_purchase' => $recency,
                'expected_interval_days' => $interval,
                'overdue_ratio' => $ratio,
                'cap_ratio' => IntelligenceWeights::CHURN_OVERDUE_CAP_RATIO,
                'basis' => $basis,
                'formula' => 'score = min(100, overdue_ratio / cap_ratio × 100)',
            ],
        ];
    }
}
