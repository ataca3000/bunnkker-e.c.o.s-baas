<?php

declare(strict_types=1);

namespace Tests\Feature\Operations;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\Recipe;
use Modules\Manufacturing\DecisionKernel\Domain\Enums\DecisionType;
use Modules\Manufacturing\DecisionKernel\Domain\Services\InMemoryRuleProvider;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionReason;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionRule;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Contracts\RuleProviderRegistryInterface;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Services\DecisionOrchestrator;
use Modules\Manufacturing\ManufacturingPolicy\Domain\Enums\PolicyCode;
use Modules\Manufacturing\ManufacturingService\Application\Services\ManufacturingApplicationService;
use Modules\Manufacturing\ManufacturingWorkflow\Domain\Services\ManufacturingWorkflow;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Operations\OrderLifecycle\Application\DTOs\OrderLifecycleRequest;
use Modules\Operations\OrderLifecycle\Application\DTOs\OrderLifecycleResult;
use Modules\Operations\OrderLifecycle\Application\Services\OrderLifecycleCoordinator;
use Modules\Operations\OrderLifecycle\Domain\Enums\LifecycleAction;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * PKG-07A: OrderLifecycleCoordinator — integration tests.
 *
 * Tests the full coordination chain:
 *   OrderLifecycleRequest → Policy → ManufacturingApplicationService → OrderLifecycleResult
 *
 * Each test verifies the correct LifecycleAction and `handled` flag for every outcome:
 *   - Eligible order → ManufacturingTriggered + handled=true
 *   - Policy rejected → PolicyRejected + handled=false
 *   - Manufacturing blocked → ManufacturingBlocked + handled=false
 *   - Status ignored → StatusIgnored + handled=false
 *   - Context mapping → correct policy contexts built from request
 *   - Error propagation → exceptions from infrastructure propagate
 */
class OrderLifecycleCoordinatorTest extends TestCase
{
    use RefreshDatabase;

    private OrderLifecycleCoordinator $coordinator;

    private Company $company;

    private Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();

        $this->resetSingletons();
        $this->registerRule(DecisionType::Approve);

        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);

        $this->coordinator = app(OrderLifecycleCoordinator::class);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function resetSingletons(): void
    {
        $this->app->forgetInstance(RuleProviderRegistryInterface::class);
        $this->app->forgetInstance(DecisionOrchestrator::class);
        $this->app->forgetInstance(ManufacturingWorkflow::class);
        $this->app->forgetInstance(ManufacturingApplicationService::class);
        $this->app->forgetInstance(OrderLifecycleCoordinator::class);
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

    private function rebuildCoordinatorWith(DecisionType $type): void
    {
        $this->resetSingletons();
        $this->registerRule($type);
        $this->coordinator = app(OrderLifecycleCoordinator::class);
    }

    private function makeOutput(): Product
    {
        return Product::factory()->finishedGood()->manufacturable()->create();
    }

    private function makeComponent(): Product
    {
        return Product::factory()->rawMaterial()->create();
    }

    private function makeRecipe(Product $output): Recipe
    {
        return Recipe::create([
            'bom_number' => 'BOM-OLC-'.uniqid(),
            'product_id' => $output->id,
            'version' => '1.0',
            'bom_version_number' => 1,
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

    private function makeRequest(
        Product $output,
        float $qty = 1.0,
        string $status = 'pending',
        bool $canManufacture = true,
        bool $hasRecipe = true,
        bool $inventoryManaged = true,
        bool $alreadyManufactured = false,
        bool $isCancelled = false,
    ): OrderLifecycleRequest {
        return new OrderLifecycleRequest(
            order_id: 'order-'.Str::uuid(),
            order_line_id: 'line-'.Str::uuid(),
            order_status: $status,
            is_order_cancelled: $isCancelled,
            product_id: $output->id,
            required_qty: $qty,
            product_can_manufacture: $canManufacture,
            product_has_active_recipe: $hasRecipe,
            product_is_inventory_managed: $inventoryManaged,
            warehouse_id: $this->warehouse->id,
            company_id: $this->company->id,
            actor_id: 'test-actor',
            already_manufactured: $alreadyManufactured,
        );
    }

    // ── Eligible order → ManufacturingTriggered ───────────────────────────────

    public function test_returns_manufacturing_triggered_for_eligible_pending_order(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 2.0);
        $this->seedInventory($component, 10.0);

        $result = $this->coordinator->handle($this->makeRequest($output, 1.0, 'pending'));

        $this->assertInstanceOf(OrderLifecycleResult::class, $result);
        $this->assertTrue($result->handled);
        $this->assertEquals(LifecycleAction::ManufacturingTriggered, $result->action);
        $this->assertNotNull($result->policy_result);
        $this->assertNotNull($result->manufacturing_result);
        $this->assertTrue($result->policy_result->eligible);
        $this->assertFalse($result->manufacturing_result->is_blocked);
    }

    public function test_returns_manufacturing_triggered_for_eligible_processing_order(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);

        $result = $this->coordinator->handle($this->makeRequest($output, 1.0, 'processing'));

        $this->assertTrue($result->handled);
        $this->assertEquals(LifecycleAction::ManufacturingTriggered, $result->action);
    }

    public function test_manufacturing_triggered_creates_transaction_in_database(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);

        $result = $this->coordinator->handle($this->makeRequest($output));

        $this->assertNotNull($result->manufacturing_result?->transaction_id);
        $this->assertDatabaseHas('manufacturing_transactions', [
            'id' => $result->manufacturing_result->transaction_id,
        ]);
    }

    // ── Policy rejected ───────────────────────────────────────────────────────

    public function test_returns_policy_rejected_when_product_cannot_manufacture(): void
    {
        $output = $this->makeOutput();

        $result = $this->coordinator->handle(
            $this->makeRequest($output, 1.0, 'pending', canManufacture: false),
        );

        $this->assertFalse($result->handled);
        $this->assertEquals(LifecycleAction::PolicyRejected, $result->action);
        $this->assertNotNull($result->policy_result);
        $this->assertEquals(PolicyCode::ProductCannotManufacture, $result->policy_result->policy_code);
        $this->assertNull($result->manufacturing_result);
        $this->assertDatabaseCount('manufacturing_transactions', 0);
    }

    public function test_returns_policy_rejected_when_no_active_recipe(): void
    {
        $output = $this->makeOutput();

        $result = $this->coordinator->handle(
            $this->makeRequest($output, 1.0, 'pending', hasRecipe: false),
        );

        $this->assertFalse($result->handled);
        $this->assertEquals(LifecycleAction::PolicyRejected, $result->action);
        $this->assertEquals(PolicyCode::RecipeNotFound, $result->policy_result->policy_code);
    }

    public function test_returns_policy_rejected_when_product_not_inventory_managed(): void
    {
        $output = $this->makeOutput();

        $result = $this->coordinator->handle(
            $this->makeRequest($output, 1.0, 'pending', inventoryManaged: false),
        );

        $this->assertFalse($result->handled);
        $this->assertEquals(LifecycleAction::PolicyRejected, $result->action);
        $this->assertEquals(PolicyCode::ProductNotInventoryManaged, $result->policy_result->policy_code);
    }

    public function test_returns_manufacturing_already_executed_when_already_manufactured(): void
    {
        $output = $this->makeOutput();

        $result = $this->coordinator->handle(
            $this->makeRequest($output, 1.0, 'pending', alreadyManufactured: true),
        );

        $this->assertFalse($result->handled);
        $this->assertEquals(LifecycleAction::ManufacturingAlreadyExecuted, $result->action);
        $this->assertNotNull($result->policy_result);
        $this->assertEquals(PolicyCode::AlreadyManufactured, $result->policy_result->policy_code);
        $this->assertNull($result->manufacturing_result);
    }

    public function test_policy_rejected_reason_comes_from_policy_result(): void
    {
        $output = $this->makeOutput();

        $result = $this->coordinator->handle(
            $this->makeRequest($output, 1.0, 'pending', canManufacture: false),
        );

        $this->assertNotEmpty($result->reason);
        $this->assertEquals($result->policy_result->reason, $result->reason);
    }

    // ── Manufacturing not required ────────────────────────────────────────────

    public function test_returns_manufacturing_not_required_when_fg_stock_is_sufficient(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);
        // Seeding the OUTPUT product with sufficient on-hand qty causes the workflow
        // to detect it does not need to manufacture and return 'manufacturing_not_needed'.
        $this->seedInventory($output, 10.0);

        $result = $this->coordinator->handle($this->makeRequest($output, 1.0));

        $this->assertFalse($result->handled);
        $this->assertEquals(LifecycleAction::ManufacturingNotRequired, $result->action);
        $this->assertNotNull($result->policy_result);
        $this->assertTrue($result->policy_result->eligible);
        $this->assertNotNull($result->manufacturing_result);
        $this->assertTrue($result->manufacturing_result->is_blocked);
        $this->assertDatabaseCount('manufacturing_transactions', 0);
    }

    // ── Manufacturing blocked ─────────────────────────────────────────────────

    public function test_returns_manufacturing_blocked_when_workflow_blocks_on_decision(): void
    {
        $this->rebuildCoordinatorWith(DecisionType::Reject);

        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);

        $result = $this->coordinator->handle($this->makeRequest($output));

        $this->assertFalse($result->handled);
        $this->assertEquals(LifecycleAction::ManufacturingBlocked, $result->action);
        $this->assertNotNull($result->policy_result);
        $this->assertTrue($result->policy_result->eligible);
        $this->assertNotNull($result->manufacturing_result);
        $this->assertTrue($result->manufacturing_result->is_blocked);
        $this->assertEquals('decision_rejected', $result->manufacturing_result->blocking_reason);
        $this->assertDatabaseCount('manufacturing_transactions', 0);
    }

    public function test_manufacturing_blocked_reason_includes_blocking_reason(): void
    {
        $this->rebuildCoordinatorWith(DecisionType::Reject);

        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);

        $result = $this->coordinator->handle($this->makeRequest($output));

        $this->assertStringContainsString('decision_rejected', $result->reason);
    }

    // ── Status ignored ────────────────────────────────────────────────────────

    public function test_returns_status_ignored_for_completed_order(): void
    {
        $output = $this->makeOutput();

        $result = $this->coordinator->handle($this->makeRequest($output, 1.0, 'completed'));

        $this->assertFalse($result->handled);
        $this->assertEquals(LifecycleAction::StatusIgnored, $result->action);
        $this->assertNull($result->policy_result);
        $this->assertNull($result->manufacturing_result);
        $this->assertDatabaseCount('manufacturing_transactions', 0);
    }

    public function test_returns_status_ignored_for_cancelled_status_at_coordinator_level(): void
    {
        // 'cancelled' is not in MANUFACTURING_TRIGGER_STATUSES, so
        // coordinator short-circuits before even calling the policy.
        // is_cancelled=true would be caught by the policy's rule 1,
        // but it never gets that far.
        $output = $this->makeOutput();

        $result = $this->coordinator->handle(
            $this->makeRequest($output, 1.0, 'cancelled', isCancelled: true),
        );

        $this->assertEquals(LifecycleAction::StatusIgnored, $result->action);
        $this->assertNull($result->policy_result);
    }

    public function test_returns_status_ignored_for_unknown_status(): void
    {
        $output = $this->makeOutput();

        $result = $this->coordinator->handle($this->makeRequest($output, 1.0, 'on_hold'));

        $this->assertEquals(LifecycleAction::StatusIgnored, $result->action);
        $this->assertStringContainsString('on_hold', $result->reason);
    }

    // ── Context mapping ───────────────────────────────────────────────────────

    public function test_context_correctly_maps_order_and_product_ids_to_policy(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);

        $request = $this->makeRequest($output);
        $result = $this->coordinator->handle($request);

        // Policy result metadata must contain the order and product IDs from the request
        $this->assertEquals($request->product_id, $result->policy_result?->metadata['product_id'] ?? null);
        $this->assertEquals($request->order_id, $result->policy_result?->metadata['order_id'] ?? null);
        $this->assertEquals($request->order_line_id, $result->policy_result?->metadata['order_line_id'] ?? null);
    }

    public function test_manufacturing_request_carries_order_metadata(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);

        $request = $this->makeRequest($output);
        $result = $this->coordinator->handle($request);

        // The executor stores request metadata nested under source_metadata inside transaction_metadata.
        // So order_id and order_line_id live at metadata['source_metadata']['order_id'].
        $sourceMetadata = $result->manufacturing_result?->metadata['source_metadata'] ?? [];
        $this->assertEquals($request->order_id, $sourceMetadata['order_id'] ?? null);
        $this->assertEquals($request->order_line_id, $sourceMetadata['order_line_id'] ?? null);
    }

    // ── Result structure invariants ───────────────────────────────────────────

    public function test_status_ignored_result_is_not_handled(): void
    {
        $result = $this->coordinator->handle(
            $this->makeRequest($this->makeOutput(), 1.0, 'completed'),
        );
        $this->assertFalse($result->handled);
    }

    public function test_policy_rejected_result_is_not_handled(): void
    {
        $result = $this->coordinator->handle(
            $this->makeRequest($this->makeOutput(), 1.0, 'pending', canManufacture: false),
        );
        $this->assertFalse($result->handled);
    }

    public function test_manufacturing_blocked_result_is_not_handled(): void
    {
        $this->rebuildCoordinatorWith(DecisionType::Reject);

        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);

        $result = $this->coordinator->handle($this->makeRequest($output));

        $this->assertFalse($result->handled);
    }

    public function test_result_serializes_to_array_with_all_keys(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);

        $array = $this->coordinator->handle($this->makeRequest($output))->toArray();

        foreach ([
            'order_id', 'order_line_id', 'handled', 'action',
            'reason', 'policy_result', 'manufacturing_result', 'metadata',
        ] as $key) {
            $this->assertArrayHasKey($key, $array, "Missing key: $key");
        }
        $this->assertEquals('manufacturing_triggered', $array['action']);
    }

    public function test_status_ignored_result_serializes_with_null_sub_results(): void
    {
        $array = $this->coordinator->handle(
            $this->makeRequest($this->makeOutput(), 1.0, 'completed'),
        )->toArray();

        $this->assertNull($array['policy_result']);
        $this->assertNull($array['manufacturing_result']);
        $this->assertEquals('status_ignored', $array['action']);
    }
}
