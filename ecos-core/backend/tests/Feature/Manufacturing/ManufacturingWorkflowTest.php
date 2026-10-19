<?php

declare(strict_types=1);

namespace Tests\Feature\Manufacturing;

use DateTimeImmutable;
use DateTimeInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Manufacturing\AvailabilityEngine\Domain\Enums\ManufacturingEligibility;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\Recipe;
use Modules\Manufacturing\DecisionKernel\Domain\Enums\DecisionType;
use Modules\Manufacturing\DecisionKernel\Domain\Services\InMemoryRuleProvider;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionReason;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionRule;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionTrigger;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Contracts\RuleProviderRegistryInterface;
use Modules\Manufacturing\ManufacturingWorkflow\Domain\Enums\WorkflowBlockingReason;
use Modules\Manufacturing\ManufacturingWorkflow\Domain\Enums\WorkflowStage;
use Modules\Manufacturing\ManufacturingWorkflow\Domain\Services\ManufacturingWorkflow;
use Modules\Manufacturing\ManufacturingWorkflow\Domain\ValueObjects\ManufacturingWorkflowRequest;
use Modules\Manufacturing\ManufacturingWorkflow\Domain\ValueObjects\ManufacturingWorkflowResult;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * PKG-04C: ManufacturingWorkflow — feature tests.
 *
 * Tests the full three-engine coordination:
 *   Decision Orchestrator → Availability Engine → Manufacturing Planner
 *
 * The registry is mutated per test — each test registers its own rule provider
 * before calling the workflow. RefreshDatabase rolls back DB state; the
 * in-memory registry is reset in setUp() by forgetting the singleton.
 */
class ManufacturingWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private ManufacturingWorkflow $workflow;

    private Company $company;

    private Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();

        // Reset singletons so each test gets a clean registry + orchestrator.
        // The orchestrator captures its registry by reference, so replacing the
        // registry binding and forgetting the orchestrator singleton causes a
        // fresh orchestrator to be built with the fresh registry on next resolve.
        $this->app->forgetInstance(RuleProviderRegistryInterface::class);
        $this->app->forgetInstance(
            \Modules\Manufacturing\DecisionOrchestrator\Domain\Services\DecisionOrchestrator::class,
        );
        $this->app->forgetInstance(ManufacturingWorkflow::class);

        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);

        // Default rule: approve everything. Override per test when needed.
        $this->registerRule(DecisionType::Approve);

        $this->workflow = app(ManufacturingWorkflow::class);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function registerRule(DecisionType $type, string $id = 'test-rule'): void
    {
        app(RuleProviderRegistryInterface::class)->register(
            'manufacturing',
            new InMemoryRuleProvider(
                new DecisionRule(
                    rule_id: $id,
                    name: "Test rule: {$type->label()}",
                    priority: 1,
                    decision_type: $type,
                    reason: new DecisionReason(code: "test_{$type->value}", message: $type->label()),
                    condition: fn ($ctx) => true,
                ),
            ),
        );
    }

    private function resetWorkflowWithRule(DecisionType $type): ManufacturingWorkflow
    {
        $this->app->forgetInstance(RuleProviderRegistryInterface::class);
        $this->app->forgetInstance(
            \Modules\Manufacturing\DecisionOrchestrator\Domain\Services\DecisionOrchestrator::class,
        );
        $this->app->forgetInstance(ManufacturingWorkflow::class);

        $this->registerRule($type);

        return app(ManufacturingWorkflow::class);
    }

    private function makeOutput(): Product
    {
        return Product::factory()->finishedGood()->manufacturable()->create();
    }

    private function makeComponent(bool $allowNegative = false): Product
    {
        return Product::factory()->rawMaterial()->create([
            'allow_negative_stock' => $allowNegative,
        ]);
    }

    private function makeRecipe(Product $output, int $version = 1): Recipe
    {
        return Recipe::create([
            'bom_number' => 'BOM-WF-'.uniqid(),
            'product_id' => $output->id,
            'version' => "{$version}.0",
            'bom_version_number' => $version,
            'is_active' => true,
        ]);
    }

    private function addLine(Recipe $recipe, Product $component, float $qty): void
    {
        $recipe->components()->create([
            'raw_material_id' => $component->id,
            'quantity' => $qty,
        ]);
    }

    private function seedInventory(Product $product, float $onHand): InventoryItem
    {
        return InventoryItem::query()->create([
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $product->id,
            'company_id' => $this->company->id,
            'on_hand_qty' => $onHand,
            'reserved_qty' => 0.0,
        ]);
    }

    private function makeTrigger(): DecisionTrigger
    {
        return new DecisionTrigger(
            trigger_type: 'manual',
            trigger_id: 'test-trigger-'.uniqid(),
            trigger_version: 'v1',
            triggered_at: (new DateTimeImmutable)->format(DateTimeInterface::ATOM),
            actor_id: 'test-actor-001',
        );
    }

    private function makeRequest(
        Product $output,
        float $requiredQty = 10.0,
        array $metadata = [],
    ): ManufacturingWorkflowRequest {
        return new ManufacturingWorkflowRequest(
            product_id: $output->id,
            warehouse_id: $this->warehouse->id,
            // Required since F-INV-H2 made inventory reads company-scoped. The
            // fixture already owns a company; it simply was not being passed.
            company_id: $this->company->id,
            required_qty: $requiredQty,
            trigger: $this->makeTrigger(),
            metadata: $metadata,
        );
    }

    // ── 1. Successful Planning Workflow ───────────────────────────────────────

    public function test_successful_workflow_returns_plan_ready_result(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 2.0);
        $this->seedInventory($component, onHand: 100.0);

        $result = $this->workflow->run($this->makeRequest($output, requiredQty: 5.0));

        $this->assertInstanceOf(ManufacturingWorkflowResult::class, $result);
        $this->assertFalse($result->is_blocked);
        $this->assertNull($result->blocking_reason);
        $this->assertTrue($result->isPlanReady());
        $this->assertSame(WorkflowStage::PlanProduced, $result->stage);
    }

    public function test_successful_workflow_result_carries_all_engine_outputs(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, onHand: 50.0);

        $result = $this->workflow->run($this->makeRequest($output, requiredQty: 10.0));

        $this->assertNotNull($result->decision_result);
        $this->assertNotNull($result->recipe_snapshot);
        $this->assertNotNull($result->availability_result);
        $this->assertNotNull($result->plan);
    }

    public function test_successful_workflow_result_carries_workflow_id(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, onHand: 50.0);

        $result = $this->workflow->run($this->makeRequest($output));

        $this->assertNotEmpty($result->workflow_id);
        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/',
            $result->workflow_id,
        );
    }

    public function test_successful_workflow_result_has_completed_at_timestamp(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, onHand: 50.0);

        $result = $this->workflow->run($this->makeRequest($output));

        $this->assertNotEmpty($result->completed_at);
        $parsed = DateTimeImmutable::createFromFormat(DateTimeInterface::ATOM, $result->completed_at);
        $this->assertNotFalse($parsed, 'completed_at must be valid ISO 8601');
    }

    // ── 2. Decision Blocked ───────────────────────────────────────────────────

    public function test_decision_reject_returns_blocked_at_decision_stage(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);

        $workflow = $this->resetWorkflowWithRule(DecisionType::Reject);
        $result = $workflow->run($this->makeRequest($output));

        $this->assertTrue($result->is_blocked);
        $this->assertSame(WorkflowStage::DecisionEvaluated, $result->stage);
        $this->assertSame(WorkflowBlockingReason::DecisionRejected, $result->blocking_reason);
    }

    public function test_decision_defer_returns_deferred_blocking_reason(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);

        $workflow = $this->resetWorkflowWithRule(DecisionType::Defer);
        $result = $workflow->run($this->makeRequest($output));

        $this->assertTrue($result->is_blocked);
        $this->assertSame(WorkflowBlockingReason::DecisionDeferred, $result->blocking_reason);
    }

    public function test_decision_blocked_does_not_call_availability_or_planner(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);

        $workflow = $this->resetWorkflowWithRule(DecisionType::Reject);
        $result = $workflow->run($this->makeRequest($output));

        // Availability and plan are null — engines were not called
        $this->assertNull($result->availability_result);
        $this->assertNull($result->plan);
    }

    public function test_decision_blocked_still_carries_decision_result(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);

        $workflow = $this->resetWorkflowWithRule(DecisionType::Reject);
        $result = $workflow->run($this->makeRequest($output));

        $this->assertNotNull($result->decision_result);
        $this->assertSame(DecisionType::Reject, $result->decision_result->decision);
    }

    // ── 3. Availability Blocked ───────────────────────────────────────────────

    public function test_cannot_manufacture_returns_blocked_at_availability_stage(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent(allowNegative: false);
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 10.0);
        // No inventory seeded → component is short and allow_negative_stock = false

        $result = $this->workflow->run($this->makeRequest($output, requiredQty: 5.0));

        $this->assertTrue($result->is_blocked);
        $this->assertSame(WorkflowStage::AvailabilityAnalysed, $result->stage);
        $this->assertSame(WorkflowBlockingReason::CannotManufacture, $result->blocking_reason);
    }

    public function test_availability_blocked_carries_availability_result(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent(allowNegative: false);
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 10.0);

        $result = $this->workflow->run($this->makeRequest($output, requiredQty: 5.0));

        $this->assertNotNull($result->availability_result);
        $this->assertSame(
            ManufacturingEligibility::CannotManufacture,
            $result->availability_result->eligibility,
        );
    }

    public function test_availability_blocked_does_not_produce_plan(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent(allowNegative: false);
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 10.0);

        $result = $this->workflow->run($this->makeRequest($output));

        $this->assertNull($result->plan);
    }

    public function test_no_recipe_blocks_at_decision_stage_with_recipe_not_found(): void
    {
        // Product exists but has no active recipe — orchestrator will throw RecipeResolverException
        $output = $this->makeOutput();

        $result = $this->workflow->run($this->makeRequest($output));

        $this->assertTrue($result->is_blocked);
        $this->assertSame(WorkflowBlockingReason::RecipeNotFound, $result->blocking_reason);
    }

    // ── 4. Planner Blocked (Manufacturing Not Needed) ─────────────────────────

    public function test_sufficient_fg_stock_returns_manufacturing_not_needed(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        // Seed MORE FG than needed → Sufficient eligibility
        $this->seedInventory($output, onHand: 100.0);
        $this->seedInventory($component, onHand: 100.0);

        $result = $this->workflow->run($this->makeRequest($output, requiredQty: 5.0));

        $this->assertTrue($result->is_blocked);
        $this->assertSame(WorkflowStage::PlanProduced, $result->stage);
        $this->assertSame(WorkflowBlockingReason::ManufacturingNotNeeded, $result->blocking_reason);
    }

    public function test_manufacturing_not_needed_still_carries_plan(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($output, onHand: 100.0);
        $this->seedInventory($component, onHand: 100.0);

        $result = $this->workflow->run($this->makeRequest($output, requiredQty: 5.0));

        // Plan exists but should_manufacture = false
        $this->assertNotNull($result->plan);
        $this->assertFalse($result->plan->should_manufacture);
        $this->assertFalse($result->isPlanReady());
    }

    // ── 5. Metadata Propagation ───────────────────────────────────────────────

    public function test_caller_metadata_propagated_to_result(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, onHand: 50.0);

        $metadata = ['order_id' => 'ORD-999', 'source' => 'woocommerce'];
        $result = $this->workflow->run($this->makeRequest($output, metadata: $metadata));

        // Metadata propagated into the plan (which is in result.metadata)
        $this->assertArrayHasKey('order_id', $result->metadata);
        $this->assertSame('ORD-999', $result->metadata['order_id']);
    }

    public function test_workflow_id_injected_into_plan_metadata(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, onHand: 50.0);

        $result = $this->workflow->run($this->makeRequest($output));

        $this->assertArrayHasKey('workflow_id', $result->plan->metadata);
        $this->assertSame($result->workflow_id, $result->plan->metadata['workflow_id']);
    }

    // ── 6. Snapshot Propagation ───────────────────────────────────────────────

    public function test_recipe_snapshot_from_orchestrator_in_result(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 2.0);
        $this->seedInventory($component, onHand: 50.0);

        $result = $this->workflow->run($this->makeRequest($output, requiredQty: 5.0));

        $this->assertNotNull($result->recipe_snapshot);
        $this->assertSame($output->id, $result->recipe_snapshot->product_id);
        $this->assertSame(1, $result->recipe_snapshot->bom_version_number);
    }

    public function test_plan_carries_same_recipe_snapshot_as_workflow_result(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, onHand: 50.0);

        $result = $this->workflow->run($this->makeRequest($output, requiredQty: 5.0));

        $this->assertSame(
            $result->plan->recipe_snapshot?->recipe_id,
            $result->recipe_snapshot?->recipe_id,
        );
        $this->assertSame(
            $result->plan->recipe_snapshot_hash,
            hash('sha256', json_encode($result->recipe_snapshot->toArray(), JSON_THROW_ON_ERROR)),
        );
    }

    public function test_snapshot_carried_into_blocked_by_decision_result(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);

        $workflow = $this->resetWorkflowWithRule(DecisionType::Reject);
        $result = $workflow->run($this->makeRequest($output));

        // Snapshot was resolved before decision was evaluated — must be in result
        $this->assertNotNull($result->recipe_snapshot);
        $this->assertSame($output->id, $result->recipe_snapshot->product_id);
    }

    // ── 7. Context Propagation ────────────────────────────────────────────────

    public function test_plan_carries_correct_product_and_warehouse(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, onHand: 50.0);

        $result = $this->workflow->run($this->makeRequest($output, requiredQty: 7.0));

        $this->assertSame($output->id, $result->plan->product_id);
        $this->assertSame($this->warehouse->id, $result->plan->warehouse_id);
        $this->assertSame(7.0, $result->plan->qty_to_manufacture);
    }

    public function test_availability_result_carried_into_successful_result(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, onHand: 50.0);

        $result = $this->workflow->run($this->makeRequest($output, requiredQty: 5.0));

        $this->assertNotNull($result->availability_result);
        $this->assertSame($output->id, $result->availability_result->product_id);
        $this->assertSame($this->warehouse->id, $result->availability_result->warehouse_id);
    }

    // ── 8. toArray() ──────────────────────────────────────────────────────────

    public function test_result_to_array_has_expected_keys(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, onHand: 50.0);

        $result = $this->workflow->run($this->makeRequest($output));
        $array = $result->toArray();

        $this->assertArrayHasKey('workflow_id', $array);
        $this->assertArrayHasKey('stage', $array);
        $this->assertArrayHasKey('is_blocked', $array);
        $this->assertArrayHasKey('blocking_reason', $array);
        $this->assertArrayHasKey('is_plan_ready', $array);
        $this->assertArrayHasKey('decision_result', $array);
        $this->assertArrayHasKey('recipe_snapshot', $array);
        $this->assertArrayHasKey('availability_result', $array);
        $this->assertArrayHasKey('plan', $array);
        $this->assertArrayHasKey('metadata', $array);
        $this->assertArrayHasKey('completed_at', $array);
    }
}
