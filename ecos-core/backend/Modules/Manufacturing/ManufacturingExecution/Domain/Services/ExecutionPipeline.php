<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingExecution\Domain\Services;

use DateTimeImmutable;
use DateTimeInterface;
use Exception;
use Modules\Manufacturing\ManufacturingExecution\Domain\Enums\ValidationFailureCode;
use Modules\Manufacturing\ManufacturingExecution\Domain\Exceptions\PipelineException;
use Modules\Manufacturing\ManufacturingExecution\Domain\ValueObjects\ManufacturingExecutionContext;
use Modules\Manufacturing\ManufacturingExecution\Domain\ValueObjects\PipelineValidationResult;
use Modules\Manufacturing\ManufacturingExecution\Domain\ValueObjects\ValidationFailure;
use Modules\Manufacturing\ManufacturingPlanner\Domain\ValueObjects\ComponentConsumptionPlan;
use Modules\Manufacturing\ManufacturingPlanner\Domain\ValueObjects\ManufacturingPlan;

/**
 * PKG-05A: Execution Pipeline.
 *
 * Validates a ManufacturingPlan and builds a ManufacturingExecutionContext.
 *
 * CONTRACT — this service MUST NOT:
 *   - Consume inventory
 *   - Produce finished goods
 *   - Create ledger entries
 *   - Write any database records
 *   - Dispatch events
 *   - Update costs
 *   - Create manufacturing transactions
 *
 * All validation failures are RETURNED as typed ValidationFailure objects
 * inside PipelineValidationResult — never thrown as generic exceptions.
 * PipelineException is only thrown for unrecoverable internal errors
 * (e.g. a plan.planned_at that cannot be parsed as a timestamp).
 *
 * The returned ManufacturingExecutionContext carries:
 *   - All validation results
 *   - Idempotency identifiers (execution_uuid, decision_key, correlation_id)
 *   - Pre-built transaction metadata
 *
 * The Executor (PKG-05B) must call context->isValid() before mutating anything.
 */
final class ExecutionPipeline
{
    /** Plans older than this many seconds are considered expired. */
    private const DEFAULT_EXPIRY_SECONDS = 86_400; // 24 hours

    /**
     * Validate the plan and produce an immutable execution context.
     *
     * @param  bool  $alreadyExecuted  True when the caller has confirmed a transaction
     *                                 for this plan_id already exists in the database.
     *                                 The pipeline itself never queries the DB.
     * @param  int  $expirySeconds  Override the default 24-hour expiry window.
     *
     * @throws PipelineException When plan.planned_at cannot be parsed (unrecoverable).
     */
    public function prepare(
        ManufacturingPlan $plan,
        bool $alreadyExecuted = false,
        int $expirySeconds = self::DEFAULT_EXPIRY_SECONDS,
    ): ManufacturingExecutionContext {
        $failures = [];

        // Collect ALL failures — never short-circuit on the first one.
        if ($f = $this->validateRequiredMetadata($plan)) {
            $failures[] = $f;
        }
        if ($f = $this->validatePlanExecutable($plan)) {
            $failures[] = $f;
        }
        if ($f = $this->validateSnapshotPresent($plan)) {
            $failures[] = $f;
        }
        if ($f = $this->validateSnapshotHashPresent($plan)) {
            $failures[] = $f;
        }
        // Only verify hash if both snapshot and hash are present.
        if ($f = $this->validateSnapshotHash($plan)) {
            $failures[] = $f;
        }
        if ($f = $this->validatePlanVersion($plan)) {
            $failures[] = $f;
        }
        // Only compare versions if both plan and snapshot have version numbers.
        if ($f = $this->validateRecipeVersion($plan)) {
            $failures[] = $f;
        }
        if ($f = $this->validateDecisionKey($plan)) {
            $failures[] = $f;
        }
        if ($f = $this->validateIdempotency($alreadyExecuted, $plan)) {
            $failures[] = $f;
        }
        // May throw PipelineException — intentionally not caught here.
        if ($f = $this->validateExpiry($plan, $expirySeconds)) {
            $failures[] = $f;
        }
        if ($f = $this->validateComponentConsistency($plan)) {
            $failures[] = $f;
        }

        $validationResult = $failures === []
            ? PipelineValidationResult::valid()
            : PipelineValidationResult::invalid($failures);

        return new ManufacturingExecutionContext(
            plan: $plan,
            recipe_snapshot: $plan->recipe_snapshot,
            snapshot_hash: $plan->recipe_snapshot_hash,
            decision_key: $this->generateDecisionKey($plan),
            execution_uuid: $this->generateUuid(),
            transaction_metadata: $this->buildTransactionMetadata($plan),
            validation_result: $validationResult,
            correlation_id: $this->extractCorrelationId($plan),
            execution_timestamp: (new DateTimeImmutable)->format(DateTimeInterface::ATOM),
        );
    }

    // ── Validators ────────────────────────────────────────────────────────────

    private function validateRequiredMetadata(ManufacturingPlan $plan): ?ValidationFailure
    {
        $missing = [];

        if ($plan->plan_id === '') {
            $missing[] = 'plan_id';
        }
        if ($plan->product_id === '') {
            $missing[] = 'product_id';
        }
        if ($plan->warehouse_id === '') {
            $missing[] = 'warehouse_id';
        }

        if ($missing !== []) {
            return new ValidationFailure(
                code: ValidationFailureCode::MissingRequiredMetadata,
                message: 'Plan is missing required identity fields: '.implode(', ', $missing).'.',
                context: ['missing_fields' => $missing],
            );
        }

        return null;
    }

    private function validatePlanExecutable(ManufacturingPlan $plan): ?ValidationFailure
    {
        if (! $plan->should_manufacture) {
            return new ValidationFailure(
                code: ValidationFailureCode::PlanNotExecutable,
                message: 'Plan cannot be executed: should_manufacture is false.',
                context: [
                    'eligibility' => $plan->eligibility->value,
                    'can_proceed' => $plan->can_proceed,
                    'decision_type' => $plan->decision_type->value,
                ],
            );
        }

        return null;
    }

    private function validateSnapshotPresent(ManufacturingPlan $plan): ?ValidationFailure
    {
        if ($plan->should_manufacture && $plan->recipe_snapshot === null) {
            return new ValidationFailure(
                code: ValidationFailureCode::SnapshotMissing,
                message: 'Plan requires manufacturing but carries no RecipeSnapshot.',
                context: ['plan_id' => $plan->plan_id],
            );
        }

        return null;
    }

    private function validateSnapshotHashPresent(ManufacturingPlan $plan): ?ValidationFailure
    {
        if ($plan->should_manufacture && $plan->recipe_snapshot_hash === null) {
            return new ValidationFailure(
                code: ValidationFailureCode::SnapshotHashMissing,
                message: 'Plan requires manufacturing but carries no snapshot hash for integrity verification.',
                context: ['plan_id' => $plan->plan_id],
            );
        }

        return null;
    }

    private function validateSnapshotHash(ManufacturingPlan $plan): ?ValidationFailure
    {
        // Both must be present for hash verification to be possible.
        if ($plan->recipe_snapshot === null || $plan->recipe_snapshot_hash === null) {
            return null;
        }

        $computed = hash('sha256', json_encode($plan->recipe_snapshot->toArray(), JSON_THROW_ON_ERROR));

        if (! hash_equals($plan->recipe_snapshot_hash, $computed)) {
            return new ValidationFailure(
                code: ValidationFailureCode::SnapshotHashMismatch,
                message: 'RecipeSnapshot hash mismatch — the plan snapshot may have been tampered with or is stale.',
                context: [
                    'stored' => $plan->recipe_snapshot_hash,
                    'computed' => $computed,
                    'plan_id' => $plan->plan_id,
                ],
            );
        }

        return null;
    }

    private function validatePlanVersion(ManufacturingPlan $plan): ?ValidationFailure
    {
        if ($plan->bom_version_number === null || $plan->bom_version_number < 1) {
            return new ValidationFailure(
                code: ValidationFailureCode::PlanVersionMissing,
                message: 'Plan is missing a valid BOM version number (must be an integer >= 1).',
                context: ['bom_version_number' => $plan->bom_version_number],
            );
        }

        return null;
    }

    private function validateRecipeVersion(ManufacturingPlan $plan): ?ValidationFailure
    {
        // Only meaningful when both plan version and snapshot are present.
        if ($plan->bom_version_number === null || $plan->recipe_snapshot === null) {
            return null;
        }

        if ($plan->bom_version_number !== $plan->recipe_snapshot->bom_version_number) {
            return new ValidationFailure(
                code: ValidationFailureCode::RecipeVersionMismatch,
                message: 'Plan BOM version does not match the embedded snapshot version.',
                context: [
                    'plan_version' => $plan->bom_version_number,
                    'snapshot_version' => $plan->recipe_snapshot->bom_version_number,
                    'plan_id' => $plan->plan_id,
                ],
            );
        }

        return null;
    }

    private function validateDecisionKey(ManufacturingPlan $plan): ?ValidationFailure
    {
        if ($plan->should_manufacture && $plan->recipe_id === null) {
            return new ValidationFailure(
                code: ValidationFailureCode::DecisionKeyUnderivable,
                message: 'Cannot derive a decision key: plan requires manufacturing but recipe_id is null.',
                context: ['plan_id' => $plan->plan_id],
            );
        }

        return null;
    }

    private function validateIdempotency(bool $alreadyExecuted, ManufacturingPlan $plan): ?ValidationFailure
    {
        if ($alreadyExecuted) {
            return new ValidationFailure(
                code: ValidationFailureCode::AlreadyExecuted,
                message: 'A manufacturing transaction for this plan has already been executed.',
                context: ['plan_id' => $plan->plan_id],
            );
        }

        return null;
    }

    /**
     * @throws PipelineException When planned_at cannot be parsed.
     */
    private function validateExpiry(ManufacturingPlan $plan, int $expirySeconds): ?ValidationFailure
    {
        try {
            $plannedAt = new DateTimeImmutable($plan->planned_at);
        } catch (Exception) {
            throw PipelineException::clockFailure($plan->planned_at);
        }

        $ageSeconds = time() - $plannedAt->getTimestamp();

        if ($ageSeconds > $expirySeconds) {
            return new ValidationFailure(
                code: ValidationFailureCode::PlanExpired,
                message: "Plan has expired: created {$ageSeconds}s ago, exceeds the {$expirySeconds}s execution window.",
                context: [
                    'planned_at' => $plan->planned_at,
                    'age_seconds' => $ageSeconds,
                    'expiry_seconds' => $expirySeconds,
                ],
            );
        }

        return null;
    }

    private function validateComponentConsistency(ManufacturingPlan $plan): ?ValidationFailure
    {
        // Nothing to validate if there are no components or no snapshot to compare against.
        if ($plan->components === [] || $plan->recipe_snapshot === null) {
            return null;
        }

        $snapshotComponentIds = array_map(
            fn ($c): string => $c->component_id,
            $plan->recipe_snapshot->components,
        );

        foreach ($plan->components as $component) {
            /** @var ComponentConsumptionPlan $component */
            if ($component->qty_to_consume <= 0.0) {
                return new ValidationFailure(
                    code: ValidationFailureCode::ComponentInconsistency,
                    message: "Component {$component->sku} has a non-positive consumption quantity.",
                    context: [
                        'component_id' => $component->component_id,
                        'sku' => $component->sku,
                        'qty' => $component->qty_to_consume,
                    ],
                );
            }

            if (! in_array($component->component_id, $snapshotComponentIds, true)) {
                return new ValidationFailure(
                    code: ValidationFailureCode::ComponentInconsistency,
                    message: "Component {$component->sku} in the plan is not present in the recipe snapshot.",
                    context: [
                        'component_id' => $component->component_id,
                        'snapshot_component_ids' => $snapshotComponentIds,
                    ],
                );
            }
        }

        return null;
    }

    // ── Builders ──────────────────────────────────────────────────────────────

    /**
     * Content-addressed key identifying this manufacturing DECISION.
     *
     * Deterministic: same product + warehouse + recipe version + snapshot hash
     * always produces the same key, regardless of plan_id.
     * Two identical orders that result in identical plans share the same decision key.
     */
    private function generateDecisionKey(ManufacturingPlan $plan): string
    {
        return hash('sha256', implode('|', [
            $plan->product_id,
            $plan->warehouse_id,
            $plan->recipe_id ?? '',
            (string) ($plan->bom_version_number ?? 0),
            $plan->recipe_snapshot_hash ?? '',
        ]));
    }

    private function generateUuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0F | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3F | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    /**
     * Propagate the caller's correlation_id from plan metadata if present;
     * generate a fresh UUID otherwise.
     */
    private function extractCorrelationId(ManufacturingPlan $plan): string
    {
        $correlationId = $plan->metadata['correlation_id'] ?? null;

        if (is_string($correlationId) && $correlationId !== '') {
            return $correlationId;
        }

        return $this->generateUuid();
    }

    /** @return array<string, mixed> */
    private function buildTransactionMetadata(ManufacturingPlan $plan): array
    {
        return [
            'plan_id' => $plan->plan_id,
            'product_id' => $plan->product_id,
            'product_sku' => $plan->product_sku,
            'product_name' => $plan->product_name,
            'warehouse_id' => $plan->warehouse_id,
            'bom_id' => $plan->recipe_id,
            'bom_version_number' => $plan->bom_version_number,
            'qty_to_manufacture' => $plan->qty_to_manufacture,
            'eligibility' => $plan->eligibility->value,
            'decision_type' => $plan->decision_type->value,
            'planned_at' => $plan->planned_at,
            'source_metadata' => $plan->metadata,
        ];
    }
}
