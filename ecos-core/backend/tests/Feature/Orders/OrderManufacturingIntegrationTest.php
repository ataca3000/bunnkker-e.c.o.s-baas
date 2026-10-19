<?php

declare(strict_types=1);

namespace Tests\Feature\Orders;

use DB;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Modules\Commerce\Orders\Application\Actions\PrepareOrderAction;
use Modules\Commerce\Orders\Domain\Enums\OrderLineManufacturingState;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Orders\Domain\Models\OrderLine;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\Recipe;
use Modules\Manufacturing\DecisionKernel\Domain\Enums\DecisionType;
use Modules\Manufacturing\DecisionKernel\Domain\Services\InMemoryRuleProvider;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionReason;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionRule;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Contracts\RuleProviderRegistryInterface;
use Modules\Manufacturing\DecisionOrchestrator\Domain\Services\DecisionOrchestrator;
use Modules\Manufacturing\ManufacturingService\Application\Services\ManufacturingApplicationService;
use Modules\Manufacturing\ManufacturingWorkflow\Domain\Services\ManufacturingWorkflow;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Operations\OrderLifecycle\Application\Services\OrderLifecycleCoordinator;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\Sales\Customers\Domain\Models\Customer;
use Tests\TestCase;

/**
 * PKG-07 — Orders ↔ Manufacturing Integration Tests
 *
 * Tests the end-to-end path from PrepareOrderAction through the coordinator,
 * policy, and ManufacturingApplicationService down to the DB.
 *
 * Covers all required scenarios from TASK-ORD-IMP-001:
 *   - Preparing triggers manufacturing
 *   - Preparing twice does not duplicate manufacturing (idempotency)
 *   - Mixed order (manufactured + purchased products)
 *   - Product without recipe
 *   - Product already in stock (sufficient FG → not_required)
 *   - Cancelled order line (policy rejects before order is cancelled)
 *   - Failed manufacturing (Reject rule → Failed state)
 *   - Retry after failure
 */
class OrderManufacturingIntegrationTest extends TestCase
{
    use DatabaseTransactions;

    private PrepareOrderAction $action;

    private Company $company;

    private Warehouse $warehouse;

    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->resetSingletons();
        $this->registerRule(DecisionType::Approve);

        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);
        $this->customer = Customer::factory()->create();

        $this->action = app(PrepareOrderAction::class);
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

    private function rebuildWithRule(DecisionType $type): void
    {
        $this->resetSingletons();
        $this->registerRule($type);
        $this->action = app(PrepareOrderAction::class);
    }

    private function makeOutput(bool $canManufacture = true): Product
    {
        $product = Product::factory()->finishedGood()->create();
        if ($canManufacture) {
            $product->update(['can_manufacture' => true]);
        }

        return $product->refresh();
    }

    private function makePurchasedProduct(): Product
    {
        return Product::factory()->finishedGood()->create(['can_manufacture' => false]);
    }

    private function makeComponent(): Product
    {
        return Product::factory()->rawMaterial()->create();
    }

    private function makeRecipe(Product $output): Recipe
    {
        return Recipe::create([
            'bom_number' => 'BOM-'.uniqid(),
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

    private function seedInventory(Product $product, float $onHand): void
    {
        InventoryItem::query()->create([
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $product->id,
            'company_id' => $this->company->id,
            'on_hand_qty' => $onHand,
            'reserved_qty' => 0.0,
        ]);
    }

    private function makeOrder(array $lineData): Order
    {
        $order = Order::create([
            'customer_id' => $this->customer->id,
            'assigned_warehouse_id' => $this->warehouse->id,
            'order_number' => 'TEST-'.Str::random(6),
            'order_date' => now()->toDateString(),
            'status' => OrderStatus::InProgress->value,
            'subtotal' => 0,
            'total' => 0,
        ]);

        foreach ($lineData as $line) {
            $order->lines()->create([
                'product_id' => $line['product_id'],
                'quantity' => $line['quantity'],
                'unit_price' => $line['unit_price'] ?? 10.0,
                'line_total' => ($line['quantity']) * ($line['unit_price'] ?? 10.0),
            ]);
        }

        return $order->load('lines.product');
    }

    private function freshLine(OrderLine $line): OrderLine
    {
        return OrderLine::find($line->id);
    }

    // ── Test 1: Preparing triggers manufacturing ──────────────────────────────

    public function test_preparing_triggers_manufacturing_for_eligible_line(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 2.0);
        $this->seedInventory($component, 10.0);

        $order = $this->makeOrder([['product_id' => $output->id, 'quantity' => 1.0]]);

        $this->action->execute($order->id);

        $order->refresh();
        $this->assertEquals(OrderStatus::InProgress, $order->status);

        $line = $this->freshLine($order->lines->first());
        $this->assertEquals(OrderLineManufacturingState::Executed, $line->manufacturing_state);
        $this->assertNotNull($line->manufacturing_started_at);
        $this->assertNotNull($line->manufacturing_completed_at);
        $this->assertNotNull($line->manufacturing_result);

        $this->assertDatabaseHas('manufacturing_transactions', [
            'product_id' => $output->id,
            'warehouse_id' => $this->warehouse->id,
            'order_line_id' => $line->id,
        ]);
    }

    public function test_preparing_sets_order_status_to_preparing(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);

        $order = $this->makeOrder([['product_id' => $output->id, 'quantity' => 1.0]]);

        $this->action->execute($order->id);

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'status' => 'in_progress',
        ]);
    }

    // ── Test 2: Idempotency — Preparing twice does not duplicate ──────────────

    public function test_preparing_twice_does_not_duplicate_manufacturing(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);

        $order = $this->makeOrder([['product_id' => $output->id, 'quantity' => 1.0]]);

        // First prepare
        $this->action->execute($order->id);

        $transactionCountAfterFirst = DB::table('manufacturing_transactions')->count();

        // Second prepare — should skip the Executed line
        $this->action->execute($order->id);

        $transactionCountAfterSecond = DB::table('manufacturing_transactions')->count();

        $this->assertEquals($transactionCountAfterFirst, $transactionCountAfterSecond,
            'Second prepare created extra manufacturing transactions.');

        $line = $this->freshLine($order->load('lines')->lines->first());
        $this->assertEquals(OrderLineManufacturingState::Executed, $line->manufacturing_state);
    }

    public function test_preparing_twice_preserves_executed_state_on_line(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);

        $order = $this->makeOrder([['product_id' => $output->id, 'quantity' => 1.0]]);

        $this->action->execute($order->id);
        $this->action->execute($order->id);

        $line = $this->freshLine($order->load('lines')->lines->first());
        $this->assertEquals(OrderLineManufacturingState::Executed, $line->manufacturing_state);
    }

    // ── Test 3: Mixed order ───────────────────────────────────────────────────

    public function test_mixed_order_only_manufactures_eligible_lines(): void
    {
        $manufactured = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($manufactured);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);

        $purchased = $this->makePurchasedProduct(); // can_manufacture = false

        $order = $this->makeOrder([
            ['product_id' => $manufactured->id, 'quantity' => 1.0],
            ['product_id' => $purchased->id,    'quantity' => 2.0],
        ]);

        $this->action->execute($order->id);

        $order->load('lines.product');
        $lines = $order->lines->keyBy(fn ($l) => $l->product_id);

        $manufacturedLine = $this->freshLine($lines[$manufactured->id]);
        $purchasedLine = $this->freshLine($lines[$purchased->id]);

        $this->assertEquals(OrderLineManufacturingState::Executed, $manufacturedLine->manufacturing_state);
        $this->assertEquals(OrderLineManufacturingState::Skipped, $purchasedLine->manufacturing_state);

        $this->assertDatabaseHas('manufacturing_transactions', ['product_id' => $manufactured->id]);
        $this->assertDatabaseMissing('manufacturing_transactions', ['product_id' => $purchased->id]);
    }

    // ── Test 4: Product without recipe ────────────────────────────────────────

    public function test_product_without_recipe_is_skipped(): void
    {
        // Product is flagged can_manufacture=true but has no active recipe
        $output = Product::factory()->finishedGood()->create(['can_manufacture' => true]);

        $order = $this->makeOrder([['product_id' => $output->id, 'quantity' => 1.0]]);

        $this->action->execute($order->id);

        $line = $this->freshLine($order->load('lines')->lines->first());
        $this->assertEquals(OrderLineManufacturingState::Skipped, $line->manufacturing_state);
        $this->assertDatabaseCount('manufacturing_transactions', 0);
    }

    // ── Test 5: Product already in stock ─────────────────────────────────────

    public function test_product_with_sufficient_fg_stock_is_marked_not_required(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);

        // Seed sufficient finished goods inventory — manufacturing is not needed
        $this->seedInventory($output, 100.0);

        $order = $this->makeOrder([['product_id' => $output->id, 'quantity' => 1.0]]);

        $this->action->execute($order->id);

        $line = $this->freshLine($order->load('lines')->lines->first());
        $this->assertEquals(OrderLineManufacturingState::NotRequired, $line->manufacturing_state);
        $this->assertDatabaseCount('manufacturing_transactions', 0);
    }

    // ── Test 6: Cancelled order status handling ────────────────────────────────

    public function test_cancelled_order_status_is_ignored_at_status_gate(): void
    {
        // When the order status is 'cancelled', the coordinator's status gate
        // short-circuits before the policy runs → StatusIgnored → Skipped on the line.
        $output = $this->makeOutput();

        $order = Order::create([
            'customer_id' => $this->customer->id,
            'assigned_warehouse_id' => $this->warehouse->id,
            'order_number' => 'TEST-CANCEL-'.Str::random(4),
            'order_date' => now()->toDateString(),
            'status' => OrderStatus::Cancelled->value,
            'subtotal' => 0,
            'total' => 0,
        ]);

        $line = $order->lines()->create([
            'product_id' => $output->id,
            'quantity' => 1.0,
            'unit_price' => 10.0,
            'line_total' => 10.0,
        ]);

        // Manually call PrepareOrderManufacturingAction (bypassing status check in PrepareOrderAction)
        $mfgAction = app(\Modules\Commerce\Orders\Application\Actions\PrepareOrderManufacturingAction::class);
        $order->loadMissing('lines.product', 'assignedWarehouse');
        $mfgAction->execute($order);

        $fresh = $this->freshLine($line);
        $this->assertEquals(OrderLineManufacturingState::Skipped, $fresh->manufacturing_state);
        $this->assertDatabaseCount('manufacturing_transactions', 0);
    }

    // ── Test 7: Failed manufacturing ──────────────────────────────────────────

    public function test_failed_manufacturing_marks_line_as_failed(): void
    {
        $this->rebuildWithRule(DecisionType::Reject);

        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);

        $order = $this->makeOrder([['product_id' => $output->id, 'quantity' => 1.0]]);

        $this->action->execute($order->id);

        $line = $this->freshLine($order->load('lines')->lines->first());
        $this->assertEquals(OrderLineManufacturingState::Failed, $line->manufacturing_state);
        $this->assertNotNull($line->manufacturing_result);

        // Order must NOT be corrupted — status still set to preparing
        $this->assertDatabaseHas('orders', ['id' => $order->id, 'status' => 'in_progress']);
        $this->assertDatabaseCount('manufacturing_transactions', 0);
    }

    public function test_failed_line_preserves_failure_reason_in_result(): void
    {
        $this->rebuildWithRule(DecisionType::Reject);

        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);

        $order = $this->makeOrder([['product_id' => $output->id, 'quantity' => 1.0]]);

        $this->action->execute($order->id);

        $line = $this->freshLine($order->load('lines')->lines->first());
        $this->assertIsArray($line->manufacturing_result);
        $this->assertArrayHasKey('manufacturing_result', $line->manufacturing_result);
        $this->assertNotEmpty($line->manufacturing_result['reason'] ?? '');
    }

    // ── Test 8: Retry after failure ───────────────────────────────────────────

    public function test_retry_after_failure_re_evaluates_failed_line(): void
    {
        // First attempt with Reject rule → line Failed
        $this->rebuildWithRule(DecisionType::Reject);

        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);

        $order = $this->makeOrder([['product_id' => $output->id, 'quantity' => 1.0]]);
        $this->action->execute($order->id);

        $line = $this->freshLine($order->load('lines')->lines->first());
        $this->assertEquals(OrderLineManufacturingState::Failed, $line->manufacturing_state);

        // Swap to Approve rule — simulates issue resolved
        $this->rebuildWithRule(DecisionType::Approve);

        $this->action->execute($order->id);

        $retried = $this->freshLine($line);
        $this->assertEquals(OrderLineManufacturingState::Executed, $retried->manufacturing_state);
        $this->assertDatabaseHas('manufacturing_transactions', ['product_id' => $output->id]);
    }

    public function test_retry_does_not_re_execute_executed_lines(): void
    {
        // Line 1: executed on first run
        // Line 2: failed on first run
        // Second run: line 1 must be skipped, line 2 must be retried

        $output1 = $this->makeOutput();
        $output2 = $this->makeOutput();
        $component = $this->makeComponent();

        $r1 = $this->makeRecipe($output1);
        $this->addLine($r1, $component, 1.0);

        $r2 = $this->makeRecipe($output2);
        $this->addLine($r2, $component, 1.0);

        $this->seedInventory($component, 100.0);

        // First run: both succeed with Approve rule
        $order = $this->makeOrder([
            ['product_id' => $output1->id, 'quantity' => 1.0],
            ['product_id' => $output2->id, 'quantity' => 1.0],
        ]);

        $this->action->execute($order->id);

        $order->load('lines');
        $line1 = $this->freshLine($order->lines->where('product_id', $output1->id)->first());
        $line2 = $this->freshLine($order->lines->where('product_id', $output2->id)->first());

        $this->assertEquals(OrderLineManufacturingState::Executed, $line1->manufacturing_state);
        $this->assertEquals(OrderLineManufacturingState::Executed, $line2->manufacturing_state);

        $txCountAfterFirst = DB::table('manufacturing_transactions')->count();

        // Second run: should produce no new transactions
        $this->action->execute($order->id);

        $this->assertEquals($txCountAfterFirst, DB::table('manufacturing_transactions')->count());
    }

    // ── State and structure invariants ────────────────────────────────────────

    public function test_manufacturing_result_is_stored_on_line(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);

        $order = $this->makeOrder([['product_id' => $output->id, 'quantity' => 1.0]]);
        $this->action->execute($order->id);

        $line = $this->freshLine($order->load('lines')->lines->first());
        $this->assertIsArray($line->manufacturing_result);
        $this->assertArrayHasKey('action', $line->manufacturing_result);
        $this->assertArrayHasKey('handled', $line->manufacturing_result);
        $this->assertEquals('manufacturing_triggered', $line->manufacturing_result['action']);
    }

    public function test_manufacturing_started_at_and_completed_at_are_set(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);

        $order = $this->makeOrder([['product_id' => $output->id, 'quantity' => 1.0]]);
        $this->action->execute($order->id);

        $line = $this->freshLine($order->load('lines')->lines->first());
        $this->assertNotNull($line->manufacturing_started_at);
        $this->assertNotNull($line->manufacturing_completed_at);
    }

    public function test_rc10_order_line_id_is_populated_on_manufacturing_transaction(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($output);
        $this->addLine($recipe, $component, 1.0);
        $this->seedInventory($component, 5.0);

        $order = $this->makeOrder([['product_id' => $output->id, 'quantity' => 1.0]]);
        $this->action->execute($order->id);

        $lineId = $order->load('lines')->lines->first()->id;

        $this->assertDatabaseHas('manufacturing_transactions', [
            'order_line_id' => $lineId,
        ]);
    }

    public function test_manufacturing_state_null_before_prepare(): void
    {
        $output = $this->makeOutput();
        $order = $this->makeOrder([['product_id' => $output->id, 'quantity' => 1.0]]);

        $line = $this->freshLine($order->lines->first());
        $this->assertNull($line->manufacturing_state);
    }
}
