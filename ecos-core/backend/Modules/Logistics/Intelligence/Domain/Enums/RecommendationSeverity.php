<?php

declare(strict_types=1);

namespace Modules\Logistics\Intelligence\Domain\Enums;

/**
 * How urgently a recommendation wants acting on.
 *
 * The base priority is the ONLY place a severity is turned into a number, so the
 * decision-priority ranking stays consistent wherever a recommendation is
 * raised.
 */
enum RecommendationSeverity: string
{
    case Critical = 'critical';
    case High = 'high';
    case Medium = 'medium';
    case Low = 'low';

    public function label(): string
    {
        return match ($this) {
            self::Critical => 'Critical',
            self::High => 'High',
            self::Medium => 'Medium',
            self::Low => 'Low',
        };
    }

    /** Higher sorts first. */
    public function rank(): int
    {
        return match ($this) {
            self::Critical => 4,
            self::High => 3,
            self::Medium => 2,
            self::Low => 1,
        };
    }

    /** The 0-100 floor a recommendation of this severity starts from. */
    public function basePriority(): int
    {
        return match ($this) {
            self::Critical => 90,
            self::High => 70,
            self::Medium => 45,
            self::Low => 20,
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }
}
