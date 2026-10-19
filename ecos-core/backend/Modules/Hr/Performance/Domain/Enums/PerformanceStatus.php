<?php

declare(strict_types=1);

namespace Modules\Hr\Performance\Domain\Enums;

/**
 * How a subject is doing against one goal, derived from achievement.
 *
 * The bands are named here so the dashboard, the recommendation engine and the
 * history all read the same number the same way.
 */
enum PerformanceStatus: string
{
    case Exceeded = 'exceeded';
    case Achieved = 'achieved';
    case OnTrack = 'on_track';
    case AtRisk = 'at_risk';
    case Missed = 'missed';

    public static function fromAchievement(float $percent): self
    {
        return match (true) {
            $percent >= 120.0 => self::Exceeded,
            $percent >= 100.0 => self::Achieved,
            $percent >= 80.0 => self::OnTrack,
            $percent >= 50.0 => self::AtRisk,
            default => self::Missed,
        };
    }

    public function metTarget(): bool
    {
        return in_array($this, [self::Exceeded, self::Achieved], true);
    }

    public function needsAttention(): bool
    {
        return in_array($this, [self::AtRisk, self::Missed], true);
    }

    public function label(): string
    {
        return match ($this) {
            self::Exceeded => 'Exceeded',
            self::Achieved => 'Achieved',
            self::OnTrack => 'On Track',
            self::AtRisk => 'At Risk',
            self::Missed => 'Missed',
        };
    }
}
