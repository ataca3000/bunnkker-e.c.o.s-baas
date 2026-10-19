<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Domain\Enums;

enum MaterialPriority: string
{
    case Critical = 'critical'; // shortage > 80% of required
    case High = 'high';     // shortage > 50% of required
    case Medium = 'medium';   // shortage > 20% of required
    case Low = 'low';      // shortage <= 20% of required

    public static function fromShortageRatio(float $missingQty, float $requiredQty): self
    {
        if ($requiredQty <= 0) {
            return self::Low;
        }

        $ratio = $missingQty / $requiredQty;

        return match (true) {
            $ratio > 0.8 => self::Critical,
            $ratio > 0.5 => self::High,
            $ratio > 0.2 => self::Medium,
            default => self::Low,
        };
    }
}
