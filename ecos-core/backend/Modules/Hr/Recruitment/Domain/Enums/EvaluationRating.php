<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Enums;

/**
 * How a reviewer rated a candidate.
 *
 * A named rating and a score are two views of the same judgement — a company may
 * work in either, so the enum carries the mapping rather than making each screen
 * invent one.
 */
enum EvaluationRating: string
{
    case Excellent = 'excellent';
    case VeryGood = 'very_good';
    case Good = 'good';
    case Average = 'average';
    case Weak = 'weak';

    /** The score a rating stands for, when no explicit score was given. */
    public function defaultScore(): int
    {
        return match ($this) {
            self::Excellent => 95,
            self::VeryGood => 80,
            self::Good => 65,
            self::Average => 50,
            self::Weak => 25,
        };
    }

    /** The rating a numeric score falls into. */
    public static function fromScore(int $score): self
    {
        return match (true) {
            $score >= 90 => self::Excellent,
            $score >= 75 => self::VeryGood,
            $score >= 60 => self::Good,
            $score >= 40 => self::Average,
            default => self::Weak,
        };
    }

    /** Whether this rating would normally carry a candidate forward. */
    public function isPositive(): bool
    {
        return in_array($this, [self::Excellent, self::VeryGood, self::Good], true);
    }

    public function label(): string
    {
        return match ($this) {
            self::Excellent => 'Excellent',
            self::VeryGood => 'Very Good',
            self::Good => 'Good',
            self::Average => 'Average',
            self::Weak => 'Weak',
        };
    }
}
