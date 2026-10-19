<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingExecution\Domain\ValueObjects;

use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeSnapshot;
use Modules\Manufacturing\ManufacturingPlanner\Domain\ValueObjects\ManufacturingPlan;

/**
 * Immutable output of the ExecutionPipeline.
 *
 * Carries everything the Executor (PKG-05B) needs:
 *   - The original plan (read-only reference)
 *   - The resolved recipe snapshot and its verified hash
 *   - Idempotency identifiers (execution_uuid, decision_key, correlation_id)
 *   - Pre-built transaction metadata
 *   - The full validation result (pass or typed failures)
 *
 * The Executor MUST check isValid() before performing any mutations.
 *
 * NO inventory has been touched at the point this object is created.
 */
final readonly class ManufacturingExecutionContext
{
    public function __construct(
        /** The plan that was validated. */
        public ManufacturingPlan $plan,

        /** Forwarded from plan.recipe_snapshot. Null when no recipe applies. */
        public ?RecipeSnapshot $recipe_snapshot,

        /** Forwarded from plan.recipe_snapshot_hash. Null when no recipe applies. */
        public ?string $snapshot_hash,

        /**
         * Content-addressed key derived from product + warehouse + recipe + snapshot hash.
         * Deterministic: same decision inputs always produce the same key.
         * Used for idempotency across different plan_ids.
         */
        public string $decision_key,

        /**
         * UUID v4 generated fresh for each prepare() call.
         * Stored on the ManufacturingTransaction row (execution_id column).
         * Allows log correlation before the transaction is committed.
         */
        public string $execution_uuid,

        /**
         * Pre-built metadata snapshot for the ManufacturingTransaction row.
         * Contains plan identity, product info, BOM reference, and originating metadata.
         */
        public array $transaction_metadata,

        /** Typed validation result — check is_valid before mutating anything. */
        public PipelineValidationResult $validation_result,

        /**
         * Propagated from plan.metadata['correlation_id'] if present;
         * otherwise a fresh UUID v4. Ties log entries across services.
         */
        public string $correlation_id,

        /** ISO 8601 timestamp of when prepare() was called. */
        public string $execution_timestamp,
    ) {}

    public function isValid(): bool
    {
        return $this->validation_result->is_valid;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'plan_id' => $this->plan->plan_id,
            'decision_key' => $this->decision_key,
            'execution_uuid' => $this->execution_uuid,
            'correlation_id' => $this->correlation_id,
            'execution_timestamp' => $this->execution_timestamp,
            'snapshot_hash' => $this->snapshot_hash,
            'is_valid' => $this->validation_result->is_valid,
            'validation_failures' => array_map(
                fn (ValidationFailure $f): array => $f->toArray(),
                $this->validation_result->failures,
            ),
            'transaction_metadata' => $this->transaction_metadata,
        ];
    }
}
