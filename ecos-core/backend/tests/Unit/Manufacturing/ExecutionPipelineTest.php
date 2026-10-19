<?php

declare(strict_types=1);

namespace Tests\Unit\Manufacturing;

use DateTimeImmutable;
use DateTimeInterface;
use Modules\Manufacturing\AvailabilityEngine\Domain\Enums\ManufacturingEligibility;
use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeComponent;
use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeSnapshot;
use Modules\Manufacturing\DecisionKernel\Domain\Enums\DecisionType;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionReason;
use Modules\Manufacturing\ManufacturingExecution\Domain\Enums\ValidationFailureCode;
use Modules\Manufacturing\ManufacturingExecution\Domain\Exceptions\PipelineException;
use Modules\Manufacturing\ManufacturingExecution\Domain\Services\ExecutionPipeline;
use Modules\Manufacturing\ManufacturingExecution\Domain\ValueObjects\ManufacturingExecutionContext;
use Modules\Manufacturing\ManufacturingPlanner\Domain\ValueObjects\ComponentConsumptionPlan;
use Modules\Manufacturing\ManufacturingPlanner\Domain\ValueObjects\ManufacturingPlan;
use PHPUnit\Framework\TestCase;

/**
 * PKG-05A: ExecutionPipeline — pure unit tests.
 *
 * No database, no Laravel boot, no infrastructure.
 * All inputs are constructed directly from value objects.
 */
class ExecutionPipelineTest extends TestCase
{
    private ExecutionPipeline $pipeline;

    protected function setUp(): void
    {
        parent::setUp();
        $this->pipeline = new ExecutionPipeline;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function freshTimestamp(): string
    {
        return (new DateTimeImmutable)->format(DateTimeInterface::ATOM);
    }

    private function staleTimestamp(): string
    {
        return '2020-01-01T00:00:00+00:00'; // 5+ years old
    }

    private function makeComponent(string $id = 'comp-001'): RecipeComponent
    {
        return new RecipeComponent(
            component_id: $id,
            sku: 'SKU-'.$id,
            name: 'Component '.$id,
            unit_id: 'unit-001',
            unit_name: 'Kilogram',
            unit_symbol: 'kg',
            quantity: 2.0,
            allow_negative_stock: false,
        );
    }

    private function makeSnapshot(int $bomVersionNumber = 1, array $components = []): RecipeSnapshot
    {
        return new RecipeSnapshot(
            recipe_id: 'recipe-abc-001',
            bom_number: 'BOM-001',
            version: '1.0',
            bom_version_number: $bomVersionNumber,
            product_id: 'prod-fg-001',
            product_sku: 'FG-001',
            product_name: 'Finished Good Alpha',
            components: $components ?: [$this->makeComponent()],
            resolved_at: $this->freshTimestamp(),
        );
    }

    private function hashSnapshot(RecipeSnapshot $snapshot): string
    {
        return hash('sha256', json_encode($snapshot->toArray(), JSON_THROW_ON_ERROR));
    }

    private function makeComponentPlan(string $componentId = 'comp-001', float $qty = 10.0): ComponentConsumptionPlan
    {
        return new ComponentConsumptionPlan(
            component_id: $componentId,
            sku: 'SKU-'.$componentId,
            name: 'Component '.$componentId,
            unit_symbol: 'kg',
            qty_to_consume: $qty,
            available_qty: 20.0,
            missing_qty: 0.0,
            allow_negative_stock: false,
            will_go_negative: false,
            is_blocked: false,
        );
    }

    /**
     * Build a complete, valid ManufacturingPlan ready for the pipeline.
     */
    private function makePlan(
        bool $shouldManufacture = true,
        RecipeSnapshot|false|null $snapshot = false,
        string|false|null $snapshotHash = false,
        ?int $bomVersionNumber = 1,
        array $components = [],
        string $planId = 'plan-uuid-0001',
        string $productId = 'prod-fg-001',
        string $warehouseId = 'wh-001',
        string $plannedAt = '',
        array $metadata = [],
        ?string $recipeId = 'recipe-abc-001',
    ): ManufacturingPlan {
        // false = "caller did not specify" → fill in a default.
        // null  = "caller explicitly wants null" → pass through as-is.
        if ($snapshot === false) {
            $snapshot = $this->makeSnapshot($bomVersionNumber ?? 1);
        }
        if ($snapshotHash === false) {
            $snapshotHash = $snapshot !== null ? $this->hashSnapshot($snapshot) : null;
        }
        if ($components === []) {
            $components = [$this->makeComponentPlan()];
        }
        if ($plannedAt === '') {
            $plannedAt = $this->freshTimestamp();
        }

        return new ManufacturingPlan(
            plan_id: $planId,
            product_id: $productId,
            warehouse_id: $warehouseId,
            product_sku: 'FG-001',
            product_name: 'Finished Good Alpha',
            qty_to_manufacture: 5.0,
            finished_goods_to_produce: 5.0,
            available_finished_goods: 0.0,
            recipe_id: $recipeId,
            bom_version_number: $bomVersionNumber,
            recipe_snapshot: $snapshot,
            recipe_snapshot_hash: $snapshotHash,
            components: $components,
            negative_stock_decisions: [],
            eligibility: ManufacturingEligibility::CanManufacture,
            can_proceed: $shouldManufacture,
            should_manufacture: $shouldManufacture,
            decision_type: DecisionType::Approve,
            decision_reason: new DecisionReason(code: 'mfg_approved', message: 'Approved'),
            planned_at: $plannedAt,
            metadata: $metadata,
        );
    }

    // ── 1. Valid Plan ─────────────────────────────────────────────────────────

    public function test_valid_plan_returns_valid_context(): void
    {
        $plan = $this->makePlan();
        $context = $this->pipeline->prepare($plan);

        $this->assertInstanceOf(ManufacturingExecutionContext::class, $context);
        $this->assertTrue($context->isValid());
        $this->assertEmpty($context->validation_result->failures);
    }

    public function test_valid_plan_context_carries_plan_reference(): void
    {
        $plan = $this->makePlan();
        $context = $this->pipeline->prepare($plan);

        $this->assertSame($plan, $context->plan);
        $this->assertSame($plan->recipe_snapshot, $context->recipe_snapshot);
        $this->assertSame($plan->recipe_snapshot_hash, $context->snapshot_hash);
    }

    public function test_valid_plan_generates_execution_uuid(): void
    {
        $plan = $this->makePlan();
        $context = $this->pipeline->prepare($plan);

        $this->assertNotEmpty($context->execution_uuid);
        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/',
            $context->execution_uuid,
            'execution_uuid must be a valid UUID v4',
        );
    }

    public function test_each_prepare_call_generates_unique_execution_uuid(): void
    {
        $plan = $this->makePlan();
        $context1 = $this->pipeline->prepare($plan);
        $context2 = $this->pipeline->prepare($plan);

        $this->assertNotSame($context1->execution_uuid, $context2->execution_uuid);
    }

    public function test_valid_plan_generates_decision_key(): void
    {
        $plan = $this->makePlan();
        $context = $this->pipeline->prepare($plan);

        $this->assertNotEmpty($context->decision_key);
        $this->assertSame(64, strlen($context->decision_key)); // SHA-256 hex
    }

    public function test_decision_key_is_deterministic_across_calls(): void
    {
        $plan = $this->makePlan();
        $context1 = $this->pipeline->prepare($plan);
        $context2 = $this->pipeline->prepare($plan);

        $this->assertSame($context1->decision_key, $context2->decision_key);
    }

    public function test_valid_plan_sets_execution_timestamp(): void
    {
        $plan = $this->makePlan();
        $context = $this->pipeline->prepare($plan);

        $this->assertNotEmpty($context->execution_timestamp);
        $parsed = DateTimeImmutable::createFromFormat(DateTimeInterface::ATOM, $context->execution_timestamp);
        $this->assertNotFalse($parsed, 'execution_timestamp must be valid ISO 8601');
    }

    public function test_transaction_metadata_is_populated(): void
    {
        $plan = $this->makePlan();
        $context = $this->pipeline->prepare($plan);

        $meta = $context->transaction_metadata;
        $this->assertSame($plan->plan_id, $meta['plan_id']);
        $this->assertSame($plan->product_id, $meta['product_id']);
        $this->assertSame($plan->warehouse_id, $meta['warehouse_id']);
        $this->assertSame($plan->recipe_id, $meta['bom_id']);
        $this->assertSame($plan->bom_version_number, $meta['bom_version_number']);
        $this->assertSame($plan->qty_to_manufacture, $meta['qty_to_manufacture']);
        $this->assertSame($plan->eligibility->value, $meta['eligibility']);
        $this->assertSame($plan->decision_type->value, $meta['decision_type']);
    }

    public function test_to_array_returns_expected_keys(): void
    {
        $plan = $this->makePlan();
        $context = $this->pipeline->prepare($plan);
        $array = $context->toArray();

        $this->assertArrayHasKey('plan_id', $array);
        $this->assertArrayHasKey('decision_key', $array);
        $this->assertArrayHasKey('execution_uuid', $array);
        $this->assertArrayHasKey('correlation_id', $array);
        $this->assertArrayHasKey('execution_timestamp', $array);
        $this->assertArrayHasKey('snapshot_hash', $array);
        $this->assertArrayHasKey('is_valid', $array);
        $this->assertArrayHasKey('validation_failures', $array);
        $this->assertArrayHasKey('transaction_metadata', $array);
    }

    // ── 2. Invalid Snapshot ───────────────────────────────────────────────────

    public function test_invalid_snapshot_returns_snapshot_missing_failure(): void
    {
        $plan = new ManufacturingPlan(
            plan_id: 'plan-uuid-0002',
            product_id: 'prod-fg-001',
            warehouse_id: 'wh-001',
            product_sku: 'FG-001',
            product_name: 'Finished Good',
            qty_to_manufacture: 5.0,
            finished_goods_to_produce: 5.0,
            available_finished_goods: 0.0,
            recipe_id: 'recipe-abc-001',
            bom_version_number: 1,
            recipe_snapshot: null, // ← missing
            recipe_snapshot_hash: null,
            components: [],
            negative_stock_decisions: [],
            eligibility: ManufacturingEligibility::CanManufacture,
            can_proceed: true,
            should_manufacture: true,
            decision_type: DecisionType::Approve,
            decision_reason: new DecisionReason(code: 'test', message: 'test'),
            planned_at: $this->freshTimestamp(),
            metadata: [],
        );

        $context = $this->pipeline->prepare($plan);

        $this->assertFalse($context->isValid());
        $this->assertTrue(
            $context->validation_result->hasFailure(ValidationFailureCode::SnapshotMissing),
        );
    }

    public function test_invalid_snapshot_still_returns_context_not_throws(): void
    {
        $plan = $this->makePlan(shouldManufacture: true, snapshot: null, snapshotHash: null);

        // Should NOT throw — failures are returned in context
        $context = $this->pipeline->prepare($plan);

        $this->assertInstanceOf(ManufacturingExecutionContext::class, $context);
        $this->assertFalse($context->isValid());
    }

    // ── 3. Hash Mismatch ──────────────────────────────────────────────────────

    public function test_snapshot_hash_mismatch_returns_failure(): void
    {
        $snapshot = $this->makeSnapshot();
        $wrongHash = str_repeat('a', 64); // 64 hex chars but wrong value
        $plan = $this->makePlan(snapshot: $snapshot, snapshotHash: $wrongHash);

        $context = $this->pipeline->prepare($plan);

        $this->assertFalse($context->isValid());
        $this->assertTrue(
            $context->validation_result->hasFailure(ValidationFailureCode::SnapshotHashMismatch),
        );
    }

    public function test_snapshot_hash_mismatch_failure_carries_stored_and_computed(): void
    {
        $snapshot = $this->makeSnapshot();
        $wrongHash = str_repeat('b', 64);
        $plan = $this->makePlan(snapshot: $snapshot, snapshotHash: $wrongHash);

        $context = $this->pipeline->prepare($plan);
        $failures = $context->validation_result->failures;

        $mismatchFailure = null;
        foreach ($failures as $failure) {
            if ($failure->code === ValidationFailureCode::SnapshotHashMismatch) {
                $mismatchFailure = $failure;
                break;
            }
        }

        $this->assertNotNull($mismatchFailure);
        $this->assertSame($wrongHash, $mismatchFailure->context['stored']);
        $this->assertSame(64, strlen($mismatchFailure->context['computed']));
    }

    // ── 4. Duplicate Execution Detection ─────────────────────────────────────

    public function test_already_executed_returns_already_executed_failure(): void
    {
        $plan = $this->makePlan();
        $context = $this->pipeline->prepare($plan, alreadyExecuted: true);

        $this->assertFalse($context->isValid());
        $this->assertTrue(
            $context->validation_result->hasFailure(ValidationFailureCode::AlreadyExecuted),
        );
    }

    public function test_already_executed_failure_carries_plan_id(): void
    {
        $plan = $this->makePlan(planId: 'plan-dupe-123');
        $context = $this->pipeline->prepare($plan, alreadyExecuted: true);

        $failure = null;
        foreach ($context->validation_result->failures as $f) {
            if ($f->code === ValidationFailureCode::AlreadyExecuted) {
                $failure = $f;
                break;
            }
        }

        $this->assertNotNull($failure);
        $this->assertSame('plan-dupe-123', $failure->context['plan_id']);
    }

    public function test_not_already_executed_does_not_trigger_failure(): void
    {
        $plan = $this->makePlan();
        $context = $this->pipeline->prepare($plan, alreadyExecuted: false);

        $this->assertFalse(
            $context->validation_result->hasFailure(ValidationFailureCode::AlreadyExecuted),
        );
    }

    // ── 5. Invalid Recipe Version ─────────────────────────────────────────────

    public function test_recipe_version_mismatch_returns_failure(): void
    {
        // Snapshot has bom_version_number = 1, plan says 2
        $snapshot = $this->makeSnapshot(bomVersionNumber: 1);
        $plan = $this->makePlan(snapshot: $snapshot, bomVersionNumber: 2);

        $context = $this->pipeline->prepare($plan);

        $this->assertFalse($context->isValid());
        $this->assertTrue(
            $context->validation_result->hasFailure(ValidationFailureCode::RecipeVersionMismatch),
        );
    }

    public function test_recipe_version_mismatch_failure_carries_both_versions(): void
    {
        $snapshot = $this->makeSnapshot(bomVersionNumber: 1);
        $plan = $this->makePlan(snapshot: $snapshot, bomVersionNumber: 2);

        $context = $this->pipeline->prepare($plan);
        $failure = null;

        foreach ($context->validation_result->failures as $f) {
            if ($f->code === ValidationFailureCode::RecipeVersionMismatch) {
                $failure = $f;
                break;
            }
        }

        $this->assertNotNull($failure);
        $this->assertSame(2, $failure->context['plan_version']);
        $this->assertSame(1, $failure->context['snapshot_version']);
    }

    // ── 6. Invalid Plan (not executable) ─────────────────────────────────────

    public function test_plan_not_executable_returns_failure(): void
    {
        $plan = $this->makePlan(shouldManufacture: false);
        $context = $this->pipeline->prepare($plan);

        $this->assertFalse($context->isValid());
        $this->assertTrue(
            $context->validation_result->hasFailure(ValidationFailureCode::PlanNotExecutable),
        );
    }

    public function test_plan_not_executable_failure_carries_eligibility(): void
    {
        $plan = $this->makePlan(shouldManufacture: false);
        $context = $this->pipeline->prepare($plan);

        $failure = null;
        foreach ($context->validation_result->failures as $f) {
            if ($f->code === ValidationFailureCode::PlanNotExecutable) {
                $failure = $f;
                break;
            }
        }

        $this->assertNotNull($failure);
        $this->assertArrayHasKey('eligibility', $failure->context);
    }

    // ── 7. Missing Metadata ───────────────────────────────────────────────────

    public function test_empty_plan_id_returns_missing_required_metadata_failure(): void
    {
        $plan = $this->makePlan(planId: ''); // empty plan_id
        $context = $this->pipeline->prepare($plan);

        $this->assertFalse($context->isValid());
        $this->assertTrue(
            $context->validation_result->hasFailure(ValidationFailureCode::MissingRequiredMetadata),
        );
    }

    public function test_empty_product_id_returns_missing_required_metadata_failure(): void
    {
        $plan = $this->makePlan(productId: '');
        $context = $this->pipeline->prepare($plan);

        $this->assertTrue(
            $context->validation_result->hasFailure(ValidationFailureCode::MissingRequiredMetadata),
        );
    }

    public function test_empty_warehouse_id_returns_missing_required_metadata_failure(): void
    {
        $plan = $this->makePlan(warehouseId: '');
        $context = $this->pipeline->prepare($plan);

        $this->assertTrue(
            $context->validation_result->hasFailure(ValidationFailureCode::MissingRequiredMetadata),
        );
    }

    public function test_missing_metadata_failure_lists_empty_fields(): void
    {
        $plan = $this->makePlan(planId: '', productId: '');
        $context = $this->pipeline->prepare($plan);

        $failure = null;
        foreach ($context->validation_result->failures as $f) {
            if ($f->code === ValidationFailureCode::MissingRequiredMetadata) {
                $failure = $f;
                break;
            }
        }

        $this->assertNotNull($failure);
        $this->assertContains('plan_id', $failure->context['missing_fields']);
        $this->assertContains('product_id', $failure->context['missing_fields']);
    }

    // ── 8. Correlation ID Propagation ─────────────────────────────────────────

    public function test_correlation_id_propagated_from_plan_metadata(): void
    {
        $correlationId = 'corr-12345-abcde';
        $plan = $this->makePlan(metadata: ['correlation_id' => $correlationId]);
        $context = $this->pipeline->prepare($plan);

        $this->assertSame($correlationId, $context->correlation_id);
    }

    public function test_correlation_id_generated_when_not_in_metadata(): void
    {
        $plan = $this->makePlan(metadata: []); // no correlation_id
        $context = $this->pipeline->prepare($plan);

        $this->assertNotEmpty($context->correlation_id);
        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/',
            $context->correlation_id,
        );
    }

    public function test_generated_correlation_id_differs_from_execution_uuid(): void
    {
        $plan = $this->makePlan(metadata: []);
        $context = $this->pipeline->prepare($plan);

        // Both are UUIDs but must be independently generated
        $this->assertNotSame($context->correlation_id, $context->execution_uuid);
    }

    // ── 9. Multiple Failures Collected ────────────────────────────────────────

    public function test_all_failures_collected_not_short_circuited(): void
    {
        // Build a plan that violates multiple rules simultaneously
        $plan = new ManufacturingPlan(
            plan_id: '', // missing
            product_id: 'prod-fg-001',
            warehouse_id: 'wh-001',
            product_sku: null,
            product_name: null,
            qty_to_manufacture: 5.0,
            finished_goods_to_produce: 5.0,
            available_finished_goods: 0.0,
            recipe_id: null,
            bom_version_number: null, // missing
            recipe_snapshot: null, // missing
            recipe_snapshot_hash: null, // missing
            components: [],
            negative_stock_decisions: [],
            eligibility: ManufacturingEligibility::CanManufacture,
            can_proceed: true,
            should_manufacture: true, // executable but nothing else is valid
            decision_type: DecisionType::Approve,
            decision_reason: new DecisionReason(code: 'test', message: 'test'),
            planned_at: $this->freshTimestamp(),
            metadata: [],
        );

        $context = $this->pipeline->prepare($plan);

        $this->assertFalse($context->isValid());
        $this->assertGreaterThan(1, count($context->validation_result->failures));
    }

    // ── 10. Plan Expiry ───────────────────────────────────────────────────────

    public function test_expired_plan_returns_plan_expired_failure(): void
    {
        $plan = $this->makePlan(plannedAt: $this->staleTimestamp());
        $context = $this->pipeline->prepare($plan, expirySeconds: 3600);

        $this->assertFalse($context->isValid());
        $this->assertTrue(
            $context->validation_result->hasFailure(ValidationFailureCode::PlanExpired),
        );
    }

    public function test_fresh_plan_does_not_expire(): void
    {
        $plan = $this->makePlan(plannedAt: $this->freshTimestamp());
        $context = $this->pipeline->prepare($plan, expirySeconds: 86_400);

        $this->assertFalse(
            $context->validation_result->hasFailure(ValidationFailureCode::PlanExpired),
        );
    }

    // ── 11. Component Consistency ─────────────────────────────────────────────

    public function test_component_not_in_snapshot_returns_inconsistency_failure(): void
    {
        $snapshot = $this->makeSnapshot(components: [$this->makeComponent('comp-001')]);
        $plan = $this->makePlan(
            snapshot: $snapshot,
            components: [$this->makeComponentPlan('comp-UNKNOWN')], // not in snapshot
        );

        $context = $this->pipeline->prepare($plan);

        $this->assertFalse($context->isValid());
        $this->assertTrue(
            $context->validation_result->hasFailure(ValidationFailureCode::ComponentInconsistency),
        );
    }

    public function test_zero_qty_component_returns_inconsistency_failure(): void
    {
        $snapshot = $this->makeSnapshot(components: [$this->makeComponent('comp-001')]);
        $badPlan = $this->makeComponentPlan('comp-001', qty: 0.0); // zero qty
        $plan = $this->makePlan(snapshot: $snapshot, components: [$badPlan]);

        $context = $this->pipeline->prepare($plan);

        $this->assertTrue(
            $context->validation_result->hasFailure(ValidationFailureCode::ComponentInconsistency),
        );
    }

    // ── 12. PipelineException ─────────────────────────────────────────────────

    public function test_unparseable_planned_at_throws_pipeline_exception(): void
    {
        $plan = new ManufacturingPlan(
            plan_id: 'plan-uuid-0099',
            product_id: 'prod-fg-001',
            warehouse_id: 'wh-001',
            product_sku: 'FG-001',
            product_name: 'Finished Good',
            qty_to_manufacture: 5.0,
            finished_goods_to_produce: 5.0,
            available_finished_goods: 0.0,
            recipe_id: 'recipe-abc-001',
            bom_version_number: 1,
            recipe_snapshot: $this->makeSnapshot(),
            recipe_snapshot_hash: $this->hashSnapshot($this->makeSnapshot()),
            components: [$this->makeComponentPlan()],
            negative_stock_decisions: [],
            eligibility: ManufacturingEligibility::CanManufacture,
            can_proceed: true,
            should_manufacture: true,
            decision_type: DecisionType::Approve,
            decision_reason: new DecisionReason(code: 'test', message: 'test'),
            planned_at: 'not-a-valid-timestamp-$$$$', // unparseable
            metadata: [],
        );

        $this->expectException(PipelineException::class);
        $this->pipeline->prepare($plan);
    }

    public function test_pipeline_exception_has_correct_reason(): void
    {
        $snapshot = $this->makeSnapshot();
        $plan = new ManufacturingPlan(
            plan_id: 'plan-uuid-0099',
            product_id: 'prod-fg-001',
            warehouse_id: 'wh-001',
            product_sku: 'FG-001',
            product_name: 'Finished Good',
            qty_to_manufacture: 5.0,
            finished_goods_to_produce: 5.0,
            available_finished_goods: 0.0,
            recipe_id: 'recipe-abc-001',
            bom_version_number: 1,
            recipe_snapshot: $snapshot,
            recipe_snapshot_hash: $this->hashSnapshot($snapshot),
            components: [$this->makeComponentPlan()],
            negative_stock_decisions: [],
            eligibility: ManufacturingEligibility::CanManufacture,
            can_proceed: true,
            should_manufacture: true,
            decision_type: DecisionType::Approve,
            decision_reason: new DecisionReason(code: 'test', message: 'test'),
            planned_at: '###invalid###',
            metadata: [],
        );

        try {
            $this->pipeline->prepare($plan);
            $this->fail('Expected PipelineException');
        } catch (PipelineException $e) {
            $this->assertSame(PipelineException::CLOCK_FAILURE, $e->reason());
        }
    }

    // ── 13. PipelineValidationResult helpers ──────────────────────────────────

    public function test_pipeline_validation_result_valid_factory(): void
    {
        $plan = $this->makePlan();
        $context = $this->pipeline->prepare($plan);

        $this->assertTrue($context->validation_result->is_valid);
        $this->assertSame([], $context->validation_result->failures);
    }

    public function test_pipeline_validation_result_to_array(): void
    {
        $plan = $this->makePlan(shouldManufacture: false);
        $context = $this->pipeline->prepare($plan);
        $array = $context->validation_result->toArray();

        $this->assertFalse($array['is_valid']);
        $this->assertIsArray($array['failures']);
        $this->assertNotEmpty($array['failures']);
        $this->assertArrayHasKey('code', $array['failures'][0]);
        $this->assertArrayHasKey('message', $array['failures'][0]);
    }
}
