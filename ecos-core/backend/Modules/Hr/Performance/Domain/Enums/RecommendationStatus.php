<?php

declare(strict_types=1);

namespace Modules\Hr\Performance\Domain\Enums;

/**
 * What a manager did with a bonus recommendation.
 *
 * `Modified` is deliberately distinct from `Approved`: both create a bonus, but
 * modified records that the manager overrode the recommended amount, which is
 * worth being able to see later.
 */
enum RecommendationStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Modified = 'modified';

    /** Did the decision result in money? */
    public function createsBonus(): bool
    {
        return in_array($this, [self::Approved, self::Modified], true);
    }

    public function isDecided(): bool
    {
        return $this !== self::Pending;
    }

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
