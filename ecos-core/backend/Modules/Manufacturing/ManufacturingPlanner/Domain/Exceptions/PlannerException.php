<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingPlanner\Domain\Exceptions;

use RuntimeException;

/**
 * Thrown when the ManufacturingPlanner receives inputs that violate domain invariants.
 *
 * This is NOT thrown for valid-but-blocked scenarios (NoRecipe, CannotManufacture, Deferred).
 * Those produce a ManufacturingPlan with can_proceed = false and should_manufacture = false.
 *
 * This IS thrown when the caller passes contradictory data — e.g. an AvailabilityResult
 * that reports CanManufacture eligibility but has a null recipe_snapshot, which is an
 * AvailabilityEngine programming error.
 */
final class PlannerException extends RuntimeException
{
    public const RECIPE_SNAPSHOT_MISSING = 'recipe_snapshot_missing';

    private string $reason;

    private function __construct(string $message, string $reason)
    {
        parent::__construct($message);
        $this->reason = $reason;
    }

    public static function recipeSnapshotMissing(string $eligibility): self
    {
        return new self(
            "AvailabilityResult has eligibility='{$eligibility}' but recipe_snapshot is null. "
            .'This is an invariant violation — the AvailabilityEngine must populate '
            .'recipe_snapshot whenever manufacturing is needed and a recipe exists.',
            self::RECIPE_SNAPSHOT_MISSING,
        );
    }

    public function reason(): string
    {
        return $this->reason;
    }
}
