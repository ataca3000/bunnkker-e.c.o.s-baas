<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Domain\Services;

use Modules\Crm\Intelligence\Domain\Enums\HealthBand;
use Modules\Crm\Intelligence\Domain\Support\IntelligenceWeights;

/**
 * Composite customer health — a named-weight blend of four 0..100 components.
 *
 * health = 0.35·recency + 0.30·frequency + 0.20·monetary + 0.15·tenure
 *
 * Recency/frequency/monetary components come from the RFM quintile scores (1..5 →
 * 20..100); tenure rewards a longer relationship up to a two-year cap. Weights are
 * named in IntelligenceWeights; the component breakdown is returned so the score
 * is fully explainable.
 */
final class HealthScoreService
{
    /**
     * @param  array{recency_score:int, frequency_score:int, monetary_score:int}  $rfm
     * @return array<string, mixed>
     */
    public function evaluate(array $rfm, int $tenureDays): array
    {
        $recency = $this->fromQuintile($rfm['recency_score']);
        $frequency = $this->fromQuintile($rfm['frequency_score']);
        $monetary = $this->fromQuintile($rfm['monetary_score']);
        $tenure = $this->tenureComponent($tenureDays);

        $score = (int) round(
            $recency * IntelligenceWeights::HEALTH_RECENCY
            + $frequency * IntelligenceWeights::HEALTH_FREQUENCY
            + $monetary * IntelligenceWeights::HEALTH_MONETARY
            + $tenure * IntelligenceWeights::HEALTH_TENURE
        );
        $score = max(0, min(100, $score));
        $band = HealthBand::fromScore($score);

        return [
            'score' => $score,
            'band' => $band,
            'explanation' => [
                'components' => [
                    'recency' => $recency,
                    'frequency' => $frequency,
                    'monetary' => $monetary,
                    'tenure' => $tenure,
                ],
                'weights' => IntelligenceWeights::healthWeights(),
                'formula' => 'Σ component × weight',
            ],
        ];
    }

    /** A 1..5 quintile score onto a 0..100 component (score 5 → 100). */
    private function fromQuintile(int $quintile): int
    {
        return max(0, min(5, $quintile)) * 20;
    }

    private function tenureComponent(int $tenureDays): int
    {
        $ratio = $tenureDays / IntelligenceWeights::TENURE_FULL_DAYS;

        return (int) round(max(0.0, min(1.0, $ratio)) * 100);
    }
}
