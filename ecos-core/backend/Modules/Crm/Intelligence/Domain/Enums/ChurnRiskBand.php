<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Domain\Enums;

/** Churn-risk band, derived deterministically from the 0..100 churn score. */
enum ChurnRiskBand: string
{
    case Low = 'low';
    case Moderate = 'moderate';
    case High = 'high';
    case Critical = 'critical';

    public static function fromScore(int $score): self
    {
        return match (true) {
            $score < 25 => self::Low,
            $score < 50 => self::Moderate,
            $score < 75 => self::High,
            default => self::Critical,
        };
    }

    public function label(): string
    {
        return ucfirst($this->value);
    }

    /** High and critical bands are the retention work-queue. */
    public function needsIntervention(): bool
    {
        return in_array($this, [self::High, self::Critical], true);
    }
}
