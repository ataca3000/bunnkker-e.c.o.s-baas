<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\ValueObjects;

/**
 * A 0–100 summary of vehicle condition, with the factors that produced it.
 *
 * Derived on read, never stored as truth — a stored score drifts from reality
 * the moment a defect is raised. The factor breakdown travels with the score so
 * a supervisor can see what to fix rather than just how bad it is.
 */
final class HealthScore
{
    /** Weights are the default policy; a FleetHealthPolicy may override per company. */
    public const DEFAULT_WEIGHTS = [
        'defects' => 30,
        'maintenance' => 25,
        'inspection' => 15,
        'documents' => 15,
        'fuel_efficiency' => 10,
        'downtime' => 5,
    ];

    /** @param array<string, array{weight: int, score: float, note: string}> $factors */
    private function __construct(
        public readonly int $value,
        public readonly array $factors,
    ) {}

    /**
     * @param  array<string, array{weight: int, score: float, note: string}>  $factors
     *                                                                                 Each factor's `score` is 0.0–1.0, where 1.0 is perfect.
     */
    public static function fromFactors(array $factors): self
    {
        $totalWeight = 0;
        $earned = 0.0;

        foreach ($factors as $factor) {
            $totalWeight += $factor['weight'];
            $earned += $factor['weight'] * max(0.0, min(1.0, $factor['score']));
        }

        $value = $totalWeight === 0 ? 100 : (int) round(($earned / $totalWeight) * 100);

        return new self($value, $factors);
    }

    public function band(): string
    {
        return match (true) {
            $this->value >= 85 => 'good',
            $this->value >= 60 => 'fair',
            $this->value >= 40 => 'poor',
            default => 'critical',
        };
    }

    /** The factor dragging the score down hardest — what to fix first. */
    public function weakestFactor(): ?string
    {
        $worst = null;
        $worstLoss = 0.0;

        foreach ($this->factors as $name => $factor) {
            $loss = $factor['weight'] * (1.0 - max(0.0, min(1.0, $factor['score'])));
            if ($loss > $worstLoss) {
                $worstLoss = $loss;
                $worst = $name;
            }
        }

        return $worst;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'value' => $this->value,
            'band' => $this->band(),
            'weakest_factor' => $this->weakestFactor(),
            'factors' => $this->factors,
        ];
    }
}
