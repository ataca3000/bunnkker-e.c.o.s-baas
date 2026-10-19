<?php

declare(strict_types=1);

namespace Modules\Crm\Executive\Domain\Enums;

/**
 * The direction of a metric against the comparison period.
 *
 * Purely derived from the delta — the workspace never stores a trend, it computes
 * one whenever a metric is read.
 */
enum TrendDirection: string
{
    case Up = 'up';
    case Down = 'down';
    case Flat = 'flat';

    public static function fromDelta(float $delta): self
    {
        return match (true) {
            $delta > 0.0 => self::Up,
            $delta < 0.0 => self::Down,
            default => self::Flat,
        };
    }
}
