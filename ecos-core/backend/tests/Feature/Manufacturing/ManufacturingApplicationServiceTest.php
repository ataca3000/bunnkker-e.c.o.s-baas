<?php

declare(strict_types=1);

namespace Tests\Feature\Manufacturing;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\Recipe;
use Modules\Manufacturing\DecisionKernel\Domain\Enums\DecisionType;
use Modules\Manufacturing\DecisionKernel\Domain\Services\InMemoryRuleProvider;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionReason;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionRule;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Contracts\RuleProviderRegistryInterface;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Services\DecisionOrchestrator;
use Modules\Manufacturing\ManufacturingService\Application\DTOs\Requests\DisassembleProductRequest;
use Modules\Manufacturing\ManufacturingService\Application\DTOs\Requests\ManufactureProductRequest;
use Modules\Manufacturing\ManufacturingService\Application\DTOs\Requests\SimulateManufacturingRequest;
use Modules\Manufacturing\ManufacturingService\Application\DTOs\Requests\ValidateManufacturingRequest;
use Modules\Manufacturing\ManufacturingService\Application\DTOs\Responses\DisassembleProductResponse;
use Modules\Manufacturing\ManufacturingService\Application\DTOs\Responses\ManufactureProductResponse;
use Modules\Manufacturing\ManufacturingService\Application\DTOs\Responses\SimulateManufacturingResponse;
use Modules\Manufacturing\ManufacturingService\Application\DTOs\Responses\ValidateManufacturingResponse;
use Modules\Manufacturing\ManufacturingService\Application\Services\ManufacturingApplicationService;
use Modules\Manufacturing\ManufacturingWorkflow\Domain\Services\ManufacturingWorkflow;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * PKG-06A: ManufacturingApplicationService — feature tests.
 *
 * Verifies coordination: Workflow → Pipeline → Executor for each public method.
 * Each test confirms the correct Response DTO is returned for every outcome.
 *
 * Contract assertions:
 *   - No other module may call Workflow / Pipeline / Executor directly
 *   - No business rules live in this service
 *   - No Orders / POS / Scheduler integration
 *   - All 4 methods return typed, immutable Response DTOs
 */
class ManufacturingApplicationServiceTest extends TestCase
{
    use RefreshDatabase;

    private ManufacturingApplicationService $service;

    private Company $company;

    private Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();

        $this->resetSingletons();
        $this->registerRule(DecisionType::Approve);

        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);

        $this->service = app(ManufacturingApplicationService::class);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function resetSingletons(): void
    {
        $this->app->forgetInstance(RuleProviderRegistryInterface::class);
        $this->app->forgetInstance(DecisionOrchestrator::class);
        $this->app->forgetInstance(ManufacturingWorkflow::class);
        $this->app->forgetInstance(ManufacturingApplicationService::class);
    }

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

    private function rebuildServiceWith(DecisionType $type): void
    {
        $this->resetSingletons();
        $this->registerRule($type);
        $this->service = app(ManufacturingApplicationService::class);
    }

    private function makeOutput(): Product
    {
        return Product::factory()->finishedGood()->manufacturable()->create();
    }

    private function makeComponent(): Product
    {
        return Product::factory()->rawMaterial()->create();
    }

    private function makeRecipe(Product $output, int $version = 1): Recipe
    {
        return Recipe::create([
            'bom_number' => 'BOM-SVC-'.uniqid(),
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

    private function manufactureRequest(Product $output, float $qty = 1.0): ManufactureProductRequest
    {
        return new ManufactureProductRequest(
            product_id: $output->id,
            warehouse_id: $this->warehouse->id,
            company_id: $this->company->id,
            required_qty: $qty,
            actor_id: 'test-actor',
        );
    }

    private function simulateRequest(Product $output, float $qty = 1.0): SimulateManufacturingRequest
    {
        return new SimulateManufacturingRequest(
            product_id: $output->id,
            warehouse_id: $this->warehouse->id,
            company_id: $this->company->id,
            required_qty: $qty,
            actor_id: 'test-actor',
        );
    }

    private function validateRequest(Product $output, float $qty = 1.0): ValidateManufacturingRequest
    {
        return new ValidateManufacturingRequest(
            product_id: $output->id,
            warehouse_id: $this->warehouse->id,
            company_id: $this->company->id,
            required_qty: $qty,
            actor_id: 'test-actor',
        );
    }

    // ── manufactureProduct ────────────────────────────────────────────────────

    public function test_manufacture_product_executes_and_returns_typed_response(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 2.0);
        $this->seedInventory($component, 10.0);

        $response = $this->service->manufactureProduct($this->manufactureRequest($output, 1.0));

        $this->assertInstanceOf(ManufactureProductResponse::class, $response);
        $this->assertFalse($response->is_blocked);
        $this->assertNull($response->blocking_reason);
        $this->assertTrue($response->was_executed);
        $this->assertFalse($response->was_idempotent);
        $this->assertEquals(1.0, $response->qty_produced);
        $this->assertNotNull($response->execution_id);
        $this->assertNotNull($response->transaction_id);
        $this->assertNotEmpty($response->workflow_id);
        $this->assertNotNull($response->executed_at);
    }

    public function test_manufacture_product_creates_transaction_in_database(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);

        $response = $this->service->manufactureProduct($this->manufactureRequest($output, 1.0));

        $this->assertDatabaseHas('manufacturing_transactions', [
            'id' => $response->transaction_id,
        ]);
    }

    public function test_manufacture_product_decrements_component_inventory(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 3.0); // consumes 3 per output
        $this->seedInventory($component, 10.0);

        $this->service->manufactureProduct($this->manufactureRequest($output, 1.0));

        $this->assertDatabaseHas('inventory_items', [
            'product_id' => $component->id,
            'warehouse_id' => $this->warehouse->id,
            'on_hand_qty' => 7.0, // 10 - 3
        ]);
    }

    public function test_manufacture_product_returns_blocked_when_decision_is_rejected(): void
    {
        $this->rebuildServiceWith(DecisionType::Reject);

        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 10.0);

        $response = $this->service->manufactureProduct($this->manufactureRequest($output));

        $this->assertInstanceOf(ManufactureProductResponse::class, $response);
        $this->assertTrue($response->is_blocked);
        $this->assertEquals('decision_rejected', $response->blocking_reason);
        $this->assertFalse($response->was_executed);
        $this->assertFalse($response->was_idempotent);
        $this->assertEquals(0.0, $response->qty_produced);
        $this->assertNull($response->execution_id);
        $this->assertNull($response->transaction_id);
        $this->assertDatabaseCount('manufacturing_transactions', 0);
    }

    public function test_manufacture_product_returns_blocked_when_manufacturing_not_needed(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($output, 10.0); // 10 FG already in stock

        $response = $this->service->manufactureProduct($this->manufactureRequest($output, 1.0)); // only need 1

        $this->assertTrue($response->is_blocked);
        $this->assertEquals('manufacturing_not_needed', $response->blocking_reason);
        $this->assertFalse($response->was_executed);
        $this->assertDatabaseCount('manufacturing_transactions', 0);
    }

    public function test_manufacture_product_returns_blocked_when_no_recipe_exists(): void
    {
        $output = $this->makeOutput(); // no recipe attached

        $response = $this->service->manufactureProduct($this->manufactureRequest($output));

        $this->assertTrue($response->is_blocked);
        $this->assertEquals('recipe_not_found', $response->blocking_reason);
        $this->assertFalse($response->was_executed);
    }

    public function test_manufacture_product_response_serializes_to_array(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);

        $response = $this->service->manufactureProduct($this->manufactureRequest($output));
        $array = $response->toArray();

        $this->assertArrayHasKey('workflow_id', $array);
        $this->assertArrayHasKey('workflow_stage', $array);
        $this->assertArrayHasKey('is_blocked', $array);
        $this->assertArrayHasKey('blocking_reason', $array);
        $this->assertArrayHasKey('was_executed', $array);
        $this->assertArrayHasKey('was_idempotent', $array);
        $this->assertArrayHasKey('execution_id', $array);
        $this->assertArrayHasKey('transaction_id', $array);
        $this->assertArrayHasKey('qty_produced', $array);
        $this->assertArrayHasKey('consumed_components', $array);
        $this->assertArrayHasKey('ledger_entry_ids', $array);
        $this->assertArrayHasKey('duration_ms', $array);
        $this->assertArrayHasKey('executed_at', $array);
        $this->assertArrayHasKey('metadata', $array);
    }

    // ── simulateManufacturing ─────────────────────────────────────────────────

    public function test_simulate_manufacturing_returns_plan_without_executing(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 2.0);
        $this->seedInventory($component, 10.0);

        $response = $this->service->simulateManufacturing($this->simulateRequest($output, 1.0));

        $this->assertInstanceOf(SimulateManufacturingResponse::class, $response);
        $this->assertTrue($response->can_manufacture);
        $this->assertFalse($response->is_blocked);
        $this->assertNull($response->blocking_reason);
        $this->assertEquals(1.0, $response->qty_to_manufacture);
        $this->assertNotEmpty($response->components);
        $this->assertNotNull($response->recipe_id);
        $this->assertNotEmpty($response->workflow_id);

        // Verify no side effects — no transaction created
        $this->assertDatabaseCount('manufacturing_transactions', 0);
    }

    public function test_simulate_manufacturing_returns_blocked_when_decision_is_rejected(): void
    {
        $this->rebuildServiceWith(DecisionType::Reject);

        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);

        $response = $this->service->simulateManufacturing($this->simulateRequest($output));

        $this->assertFalse($response->can_manufacture);
        $this->assertTrue($response->is_blocked);
        $this->assertEquals('decision_rejected', $response->blocking_reason);
        $this->assertEquals(0.0, $response->qty_to_manufacture);
        $this->assertEmpty($response->components);
    }

    public function test_simulate_manufacturing_response_includes_component_details(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 2.0);
        $this->seedInventory($component, 10.0);

        $response = $this->service->simulateManufacturing($this->simulateRequest($output, 1.0));

        $this->assertCount(1, $response->components);
        $this->assertEquals($component->id, $response->components[0]['component_id']);
        $this->assertEquals(2.0, $response->components[0]['qty_to_consume']);
    }

    public function test_simulate_manufacturing_response_serializes_to_array(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);

        $array = $this->service->simulateManufacturing($this->simulateRequest($output))->toArray();

        foreach ([
            'workflow_id', 'workflow_stage', 'can_manufacture', 'is_blocked',
            'blocking_reason', 'qty_to_manufacture', 'components', 'negative_stock_risks',
            'decision_type', 'availability_eligibility', 'recipe_id', 'bom_version_number', 'metadata',
        ] as $key) {
            $this->assertArrayHasKey($key, $array);
        }
    }

    // ── validateManufacturing ─────────────────────────────────────────────────

    public function test_validate_manufacturing_returns_valid_report_when_plan_is_ready(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);

        $response = $this->service->validateManufacturing($this->validateRequest($output, 1.0));

        $this->assertInstanceOf(ValidateManufacturingResponse::class, $response);
        $this->assertTrue($response->is_workflow_valid);
        $this->assertNull($response->blocking_reason);
        $this->assertTrue($response->is_plan_valid_for_execution);
        $this->assertEmpty($response->pipeline_failures);
        $this->assertNotNull($response->plan_id);
        $this->assertNotNull($response->decision_key);
        $this->assertDatabaseCount('manufacturing_transactions', 0);
    }

    public function test_validate_manufacturing_returns_blocked_when_workflow_is_blocked(): void
    {
        $this->rebuildServiceWith(DecisionType::Reject);

        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);

        $response = $this->service->validateManufacturing($this->validateRequest($output));

        $this->assertInstanceOf(ValidateManufacturingResponse::class, $response);
        $this->assertFalse($response->is_workflow_valid);
        $this->assertEquals('decision_rejected', $response->blocking_reason);
        $this->assertFalse($response->is_plan_valid_for_execution);
        $this->assertEmpty($response->pipeline_failures);
        $this->assertNull($response->plan_id);
        $this->assertNull($response->decision_key);
    }

    public function test_validate_manufacturing_does_not_create_transaction(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);

        $this->service->validateManufacturing($this->validateRequest($output, 1.0));

        $this->assertDatabaseCount('manufacturing_transactions', 0);
    }

    public function test_validate_manufacturing_response_serializes_to_array(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);

        $array = $this->service->validateManufacturing($this->validateRequest($output))->toArray();

        foreach ([
            'workflow_id', 'is_workflow_valid', 'blocking_reason',
            'is_plan_valid_for_execution', 'pipeline_failures', 'plan_id',
            'decision_key', 'metadata',
        ] as $key) {
            $this->assertArrayHasKey($key, $array);
        }
    }

    // ── disassembleProduct ────────────────────────────────────────────────────

    public function test_disassemble_product_blocked_when_no_recipe(): void
    {
        // Product with no active recipe — workflow blocks at recipe resolution
        $product = Product::factory()->create([
            'can_disassemble' => true,
            'can_manufacture' => false,
        ]);

        $request = new DisassembleProductRequest(
            product_id: $product->id,
            warehouse_id: $this->warehouse->id,
            company_id: $this->company->id,
            quantity: 1.0,
            actor_id: 'test-actor',
        );

        $response = $this->service->disassembleProduct($request);

        $this->assertInstanceOf(DisassembleProductResponse::class, $response);
        $this->assertTrue($response->is_blocked);
        $this->assertSame('recipe_not_found', $response->blocking_reason);
        $this->assertFalse($response->success);
        $this->assertNull($response->execution_id);
    }

    public function test_disassemble_product_blocked_creates_no_disassembly_transactions(): void
    {
        $product = Product::factory()->create(['can_disassemble' => true]);

        $request = new DisassembleProductRequest(
            product_id: $product->id,
            warehouse_id: $this->warehouse->id,
            company_id: $this->company->id,
            quantity: 1.0,
            actor_id: 'test-actor',
        );

        $this->service->disassembleProduct($request);

        $this->assertDatabaseCount('disassembly_transactions', 0);
        $this->assertDatabaseCount('manufacturing_transactions', 0);
    }

    public function test_disassemble_product_response_serializes_to_array(): void
    {
        $product = Product::factory()->create(['can_disassemble' => true]);

        $request = new DisassembleProductRequest(
            product_id: $product->id,
            warehouse_id: $this->warehouse->id,
            company_id: $this->company->id,
            quantity: 1.0,
            actor_id: 'test-actor',
        );

        $response = $this->service->disassembleProduct($request);
        $array = $response->toArray();

        $this->assertArrayHasKey('success', $array);
        $this->assertArrayHasKey('is_blocked', $array);
        $this->assertArrayHasKey('blocking_reason', $array);
        $this->assertArrayHasKey('produced_components', $array);
        $this->assertArrayHasKey('ledger_entry_ids', $array);
    }
}
