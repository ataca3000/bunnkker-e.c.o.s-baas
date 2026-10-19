<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Domain\Enums;

/** Customer health band, derived deterministically from the 0..100 health score. */
enum HealthBand: string
{
    case Critical = 'critical';
    case AtRisk = 'at_risk';
    case Healthy = 'healthy';
    case Thriving = 'thriving';

    public static function fromScore(int $score): self
    {
        return match (true) {
            $score < 25 => self::Critical,
            $score < 50 => self::AtRisk,
            $score < 75 => self::Healthy,
            default => self::Thriving,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Critical => 'Critical',
            self::AtRisk => 'At Risk',
            self::Healthy => 'Healthy',
            self::Thriving => 'Thriving',
        };
    }
}
