<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingExecution\Domain\Exceptions;

use RuntimeException;
use Throwable;

/**
 * Thrown by ManufacturingExecutor when execution cannot proceed or fails.
 *
 * Pre-execution guards (no DB state changed):
 *   INVALID_CONTEXT    — context.isValid() is false (pipeline validation failures present)
 *   PLAN_NOT_APPROVED  — plan.should_manufacture is false (legacy; prefer INVALID_CONTEXT via Pipeline)
 *   SNAPSHOT_MISSING   — plan.should_manufacture is true but recipe_snapshot_hash is null
 *   SNAPSHOT_MISMATCH  — re-hash of plan.recipe_snapshot ≠ plan.recipe_snapshot_hash (tampered plan)
 *
 * In-execution failures propagate as Throwable from the DB transaction.
 * Callers should catch both ExecutionException and Throwable.
 */
final class ExecutionException extends RuntimeException
{
    public const INVALID_CONTEXT = 'invalid_context';

    public const PLAN_NOT_APPROVED = 'plan_not_approved';

    public const SNAPSHOT_MISSING = 'snapshot_missing';

    public const SNAPSHOT_MISMATCH = 'snapshot_mismatch';

    private string $reason;

    private string $planId;

    private function __construct(string $message, string $reason, string $planId, ?Throwable $previous = null)
    {
        parent::__construct($message, 0, $previous);
        $this->reason = $reason;
        $this->planId = $planId;
    }

    public static function invalidContext(string $planId, int $failureCount): self
    {
        return new self(
            "Execution context for plan '{$planId}' is invalid: {$failureCount} validation failure(s) present. "
            .'Run ExecutionPipeline::prepare() and check context->isValid() before calling execute().',
            self::INVALID_CONTEXT,
            $planId,
        );
    }

    public static function planNotApproved(string $planId, string $eligibility): self
    {
        return new self(
            "Plan '{$planId}' cannot be executed: should_manufacture is false (eligibility={$eligibility}). "
            .'Only plans where should_manufacture = true may be executed.',
            self::PLAN_NOT_APPROVED,
            $planId,
        );
    }

    public static function snapshotMissing(string $planId): self
    {
        return new self(
            "Plan '{$planId}' has should_manufacture = true but recipe_snapshot_hash is null. "
            .'This indicates the plan was built without a recipe, which is an invariant violation.',
            self::SNAPSHOT_MISSING,
            $planId,
        );
    }

    public static function snapshotMismatch(string $planId, string $stored, string $computed): self
    {
        return new self(
            "Plan '{$planId}' snapshot hash mismatch. "
            ."Stored hash: {$stored}. Computed hash: {$computed}. "
            .'The plan may have been tampered with or the recipe changed after planning.',
            self::SNAPSHOT_MISMATCH,
            $planId,
        );
    }

    public function reason(): string
    {
        return $this->reason;
    }

    public function planId(): string
    {
        return $this->planId;
    }
}
