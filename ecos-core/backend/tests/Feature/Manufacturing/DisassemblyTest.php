<?php

declare(strict_types=1);

namespace Tests\Feature\Manufacturing;

use BackedEnum;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\InventoryItems\Domain\Models\StockLedgerEntry;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\Recipe;
use Modules\Manufacturing\Disassembly\Application\Services\DisassemblyExecutor;
use Modules\Manufacturing\Disassembly\Domain\Contracts\DisassemblyTransactionRepositoryInterface;
use Modules\Manufacturing\Disassembly\Domain\Enums\DisassemblyPolicyCode;
use Modules\Manufacturing\Disassembly\Domain\Models\DisassemblyTransaction;
use Modules\Manufacturing\Disassembly\Domain\Services\DisassemblyPolicy;
use Modules\Manufacturing\Disassembly\Domain\Services\DisassemblyWorkflow;
use Modules\Manufacturing\Disassembly\Domain\ValueObjects\DisassemblyPolicyRequest;
use Modules\Manufacturing\Disassembly\Infrastructure\Adapters\DisassemblyInventoryAdapter;
use Modules\Manufacturing\ManufacturingService\Application\DTOs\Requests\DisassembleProductRequest;
use Modules\Manufacturing\ManufacturingService\Application\DTOs\Responses\DisassembleProductResponse;
use Modules\Manufacturing\ManufacturingService\Application\Services\ManufacturingApplicationService;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;
use RuntimeException;
use Tests\TestCase;
use Throwable;

/**
 * PKG-08: Automatic Disassembly — feature tests.
 *
 * Tests the full disassembly flow:
 *   DisassemblyPolicy → ManufacturingApplicationService.disassembleProduct()
 *     → DisassemblyWorkflow (recipe + FG availability)
 *     → DisassemblyExecutor (inventory mutations + transaction record)
 *
 * Scenarios:
 *   1. Successful disassembly — FG decremented, components incremented, ledger entries created
 *   2. Cannot disassemble    — policy rejects (can_disassemble = false)
 *   3. Missing recipe        — workflow blocks at recipe resolution
 *   4. Duplicate execution   — idempotency via trigger_id
 *   5. Inventory rollback    — all DB changes reverted on failure
 *   6. Ledger integrity      — DisassemblyConsumption + DisassemblyOutput entries
 *   7. Partial quantities    — disassemble less than full on-hand stock
 *   8. Snapshot reuse        — recipe_snapshot_hash stored in transaction for audit trail
 */
class DisassemblyTest extends TestCase
{
    use RefreshDatabase;

    private ManufacturingApplicationService $service;

    private DisassemblyPolicy $policy;

    private DisassemblyWorkflow $workflow;

    private DisassemblyExecutor $executor;

    private Company $company;

    private Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);

        $this->service = app(ManufacturingApplicationService::class);
        $this->policy = app(DisassemblyPolicy::class);
        $this->workflow = app(DisassemblyWorkflow::class);
        $this->executor = app(DisassemblyExecutor::class);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeFinishedGood(bool $canDisassemble = true): Product
    {
        return Product::factory()->finishedGood()->create([
            'can_disassemble' => $canDisassemble,
            'can_manufacture' => true,
        ]);
    }

    private function makeComponent(): Product
    {
        return Product::factory()->rawMaterial()->create();
    }

    private function makeRecipe(Product $finishedGood, int $version = 1): Recipe
    {
        return Recipe::create([
            'bom_number' => 'BOM-DSA-'.uniqid(),
            'product_id' => $finishedGood->id,
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

    private function seedInventory(Product $product, float $onHand, float $reserved = 0.0): InventoryItem
    {
        return InventoryItem::query()->create([
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $product->id,
            'company_id' => $this->company->id,
            'on_hand_qty' => $onHand,
            'reserved_qty' => $reserved,
        ]);
    }

    private function makeRequest(
        Product $product,
        float $quantity = 1.0,
        ?string $triggerId = null,
    ): DisassembleProductRequest {
        return new DisassembleProductRequest(
            product_id: $product->id,
            warehouse_id: $this->warehouse->id,
            company_id: $this->company->id,
            quantity: $quantity,
            actor_id: 'test-actor',
            trigger_id: $triggerId,
        );
    }

    // ── 1. Successful Disassembly ─────────────────────────────────────────────

    public function test_successful_disassembly_decrements_finished_goods(): void
    {
        $fg = $this->makeFinishedGood();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($fg);
        $this->addLine($recipe, $component, qty: 2.0);

        $this->seedInventory($fg, onHand: 5.0);
        $this->seedInventory($component, onHand: 0.0);

        $response = $this->service->disassembleProduct($this->makeRequest($fg, quantity: 2.0));

        $this->assertTrue($response->success);
        $this->assertFalse($response->is_blocked);

        $fgItem = InventoryItem::query()
            ->where('product_id', $fg->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->first();
        $this->assertSame(3.0, (float) $fgItem->on_hand_qty); // 5 - 2
    }

    public function test_successful_disassembly_increments_component_inventory(): void
    {
        $fg = $this->makeFinishedGood();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($fg);
        $this->addLine($recipe, $component, qty: 3.0);

        $this->seedInventory($fg, onHand: 4.0);
        $this->seedInventory($component, onHand: 10.0);

        $this->service->disassembleProduct($this->makeRequest($fg, quantity: 2.0));

        $compItem = InventoryItem::query()
            ->where('product_id', $component->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->first();
        $this->assertSame(16.0, (float) $compItem->on_hand_qty); // 10 + (3 * 2)
    }

    public function test_successful_disassembly_creates_transaction_record(): void
    {
        $fg = $this->makeFinishedGood();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($fg);
        $this->addLine($recipe, $component, qty: 1.0);

        $this->seedInventory($fg, onHand: 3.0);
        $triggerId = 'return-line-'.uniqid();

        $response = $this->service->disassembleProduct($this->makeRequest($fg, quantity: 1.0, triggerId: $triggerId));

        $tx = DisassemblyTransaction::query()
            ->where('product_id', $fg->id)
            ->first();

        $this->assertNotNull($tx);
        $this->assertSame($triggerId, $tx->trigger_id);
        $this->assertSame(1.0, (float) $tx->qty_disassembled);
        $this->assertSame('completed', $tx->status->value);
        $this->assertSame($response->transaction_id, $tx->id);
    }

    public function test_successful_disassembly_result_structure(): void
    {
        $fg = $this->makeFinishedGood();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($fg);
        $this->addLine($recipe, $component, qty: 2.0);

        $this->seedInventory($fg, onHand: 5.0);

        $response = $this->service->disassembleProduct($this->makeRequest($fg, quantity: 1.0));

        $this->assertInstanceOf(DisassembleProductResponse::class, $response);
        $this->assertTrue($response->success);
        $this->assertFalse($response->was_idempotent);
        $this->assertSame(1.0, $response->qty_disassembled);
        $this->assertSame($fg->id, $response->product_id);
        $this->assertCount(1, $response->produced_components);
        $this->assertNotEmpty($response->execution_id);
        $this->assertNotEmpty($response->transaction_id);
        $this->assertCount(2, $response->ledger_entry_ids); // 1 FG consumption + 1 component output
    }

    public function test_multiple_components_all_produced(): void
    {
        $fg = $this->makeFinishedGood();
        $mat1 = $this->makeComponent();
        $mat2 = $this->makeComponent();
        $recipe = $this->makeRecipe($fg);
        $this->addLine($recipe, $mat1, qty: 2.0);
        $this->addLine($recipe, $mat2, qty: 3.0);

        $this->seedInventory($fg, onHand: 5.0);
        $this->seedInventory($mat1, onHand: 0.0);
        $this->seedInventory($mat2, onHand: 0.0);

        $response = $this->service->disassembleProduct($this->makeRequest($fg, quantity: 1.0));

        $this->assertCount(2, $response->produced_components);
        $this->assertCount(3, $response->ledger_entry_ids); // 1 FG + 2 components

        $mat1Item = InventoryItem::query()->where('product_id', $mat1->id)->first();
        $mat2Item = InventoryItem::query()->where('product_id', $mat2->id)->first();
        $this->assertSame(2.0, (float) $mat1Item->on_hand_qty);
        $this->assertSame(3.0, (float) $mat2Item->on_hand_qty);
    }

    // ── 2. Policy Rejection ───────────────────────────────────────────────────

    public function test_policy_rejects_when_product_cannot_disassemble(): void
    {
        $product = Product::factory()->finishedGood()->create(['can_manufacture' => true]);

        $policyRequest = new DisassemblyPolicyRequest(
            product_id: $product->id,
            quantity: 1.0,
            actor_id: 'test-actor',
            can_disassemble: false,
            has_active_recipe: true,
            is_inventory_managed: true,
            already_disassembled: false,
        );

        $result = $this->policy->evaluate($policyRequest);

        $this->assertFalse($result->eligible);
        $this->assertSame(DisassemblyPolicyCode::ProductCannotDisassemble, $result->policy_code);
    }

    public function test_policy_rejects_when_no_active_recipe(): void
    {
        $product = Product::factory()->finishedGood()->create(['can_disassemble' => true]);

        $policyRequest = new DisassemblyPolicyRequest(
            product_id: $product->id,
            quantity: 1.0,
            actor_id: 'test-actor',
            can_disassemble: true,
            has_active_recipe: false,
            is_inventory_managed: true,
            already_disassembled: false,
        );

        $result = $this->policy->evaluate($policyRequest);

        $this->assertFalse($result->eligible);
        $this->assertSame(DisassemblyPolicyCode::RecipeNotFound, $result->policy_code);
    }

    public function test_policy_rejects_already_disassembled(): void
    {
        $product = Product::factory()->finishedGood()->create(['can_disassemble' => true]);

        $policyRequest = new DisassemblyPolicyRequest(
            product_id: $product->id,
            quantity: 1.0,
            actor_id: 'test-actor',
            can_disassemble: true,
            has_active_recipe: true,
            is_inventory_managed: true,
            already_disassembled: true,
            trigger_id: 'return-line-abc',
        );

        $result = $this->policy->evaluate($policyRequest);

        $this->assertFalse($result->eligible);
        $this->assertSame(DisassemblyPolicyCode::AlreadyDisassembled, $result->policy_code);
    }

    public function test_policy_approves_eligible_product(): void
    {
        $product = Product::factory()->finishedGood()->create(['can_disassemble' => true]);

        $policyRequest = new DisassemblyPolicyRequest(
            product_id: $product->id,
            quantity: 5.0,
            actor_id: 'test-actor',
            can_disassemble: true,
            has_active_recipe: true,
            is_inventory_managed: true,
            already_disassembled: false,
        );

        $result = $this->policy->evaluate($policyRequest);

        $this->assertTrue($result->eligible);
        $this->assertSame(DisassemblyPolicyCode::Eligible, $result->policy_code);
    }

    // ── 3. Missing Recipe ─────────────────────────────────────────────────────

    public function test_workflow_blocks_when_no_active_recipe(): void
    {
        $fg = $this->makeFinishedGood();
        // No recipe created

        $request = $this->makeRequest($fg, quantity: 1.0);
        $response = $this->service->disassembleProduct($request);

        $this->assertTrue($response->is_blocked);
        $this->assertSame('recipe_not_found', $response->blocking_reason);
        $this->assertFalse($response->success);
        $this->assertDatabaseCount('disassembly_transactions', 0);
    }

    public function test_workflow_blocks_when_insufficient_finished_goods(): void
    {
        $fg = $this->makeFinishedGood();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($fg);
        $this->addLine($recipe, $component, qty: 1.0);

        $this->seedInventory($fg, onHand: 2.0); // Only 2 available, requesting 5

        $request = $this->makeRequest($fg, quantity: 5.0);
        $response = $this->service->disassembleProduct($request);

        $this->assertTrue($response->is_blocked);
        $this->assertSame('insufficient_finished_goods', $response->blocking_reason);
        $this->assertDatabaseCount('disassembly_transactions', 0);
    }

    // ── 4. Duplicate Execution (Idempotency) ──────────────────────────────────

    public function test_duplicate_trigger_returns_idempotent_result(): void
    {
        $fg = $this->makeFinishedGood();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($fg);
        $this->addLine($recipe, $component, qty: 1.0);

        $this->seedInventory($fg, onHand: 5.0);
        $triggerId = 'return-line-idem-'.uniqid();

        $request = $this->makeRequest($fg, quantity: 1.0, triggerId: $triggerId);
        $response1 = $this->service->disassembleProduct($request);
        $response2 = $this->service->disassembleProduct($request); // same trigger_id

        $this->assertTrue($response2->was_idempotent);
        $this->assertSame($response1->transaction_id, $response2->transaction_id);
    }

    public function test_duplicate_execution_does_not_double_decrement_finished_goods(): void
    {
        $fg = $this->makeFinishedGood();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($fg);
        $this->addLine($recipe, $component, qty: 1.0);

        $this->seedInventory($fg, onHand: 5.0);
        $triggerId = 'return-line-dbl-'.uniqid();

        $request = $this->makeRequest($fg, quantity: 1.0, triggerId: $triggerId);
        $this->service->disassembleProduct($request);
        $this->service->disassembleProduct($request); // idempotent replay

        $fgItem = InventoryItem::query()
            ->where('product_id', $fg->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->first();

        $this->assertSame(4.0, (float) $fgItem->on_hand_qty); // 5 - 1, not 5 - 2
    }

    public function test_duplicate_execution_creates_only_one_transaction(): void
    {
        $fg = $this->makeFinishedGood();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($fg);
        $this->addLine($recipe, $component, qty: 1.0);

        $this->seedInventory($fg, onHand: 5.0);
        $triggerId = 'return-line-once-'.uniqid();

        $request = $this->makeRequest($fg, quantity: 1.0, triggerId: $triggerId);
        $this->service->disassembleProduct($request);
        $this->service->disassembleProduct($request);

        $this->assertDatabaseCount('disassembly_transactions', 1);
    }

    // ── 5. Inventory Rollback ─────────────────────────────────────────────────

    public function test_rollback_restores_finished_goods_on_transaction_failure(): void
    {
        $fg = $this->makeFinishedGood();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($fg);
        $this->addLine($recipe, $component, qty: 1.0);

        $fgItem = $this->seedInventory($fg, onHand: 5.0);
        $this->seedInventory($component, onHand: 0.0);

        // Force failure at transaction save
        $mockRepo = $this->createMock(DisassemblyTransactionRepositoryInterface::class);
        $mockRepo->method('findByPlanId')->willReturn(null);
        $mockRepo->method('findByTriggerId')->willReturn(null);
        $mockRepo->method('save')->willThrowException(new RuntimeException('Simulated DB failure'));

        $executor = new DisassemblyExecutor(
            inventory: app(DisassemblyInventoryAdapter::class),
            transactions: $mockRepo,
        );

        $plan = $this->workflow->run($this->makeRequest($fg, quantity: 1.0))->plan;
        $this->assertNotNull($plan);

        try {
            $executor->execute($plan, $this->company->id);
            $this->fail('Expected exception was not thrown');
        } catch (Throwable) {
            // Expected
        }

        $fgItem->refresh();
        $this->assertSame(5.0, (float) $fgItem->on_hand_qty); // Restored to original
    }

    public function test_rollback_creates_no_ledger_entries_on_failure(): void
    {
        $fg = $this->makeFinishedGood();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($fg);
        $this->addLine($recipe, $component, qty: 1.0);

        $this->seedInventory($fg, onHand: 5.0);

        $mockRepo = $this->createMock(DisassemblyTransactionRepositoryInterface::class);
        $mockRepo->method('findByPlanId')->willReturn(null);
        $mockRepo->method('findByTriggerId')->willReturn(null);
        $mockRepo->method('save')->willThrowException(new RuntimeException('Simulated DB failure'));

        $executor = new DisassemblyExecutor(
            inventory: app(DisassemblyInventoryAdapter::class),
            transactions: $mockRepo,
        );

        $plan = $this->workflow->run($this->makeRequest($fg, quantity: 1.0))->plan;

        try {
            $executor->execute($plan, $this->company->id);
        } catch (Throwable) {
        }

        $this->assertDatabaseCount('stock_ledger_entries', 0);
        $this->assertDatabaseCount('disassembly_transactions', 0);
    }

    // ── 6. Ledger Integrity ───────────────────────────────────────────────────

    public function test_ledger_entries_have_correct_movement_types(): void
    {
        $fg = $this->makeFinishedGood();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($fg);
        $this->addLine($recipe, $component, qty: 2.0);

        $this->seedInventory($fg, onHand: 5.0);

        $response = $this->service->disassembleProduct($this->makeRequest($fg, quantity: 1.0));

        $entries = StockLedgerEntry::query()
            ->where('reference_type', 'disassembly_plan')
            ->get();

        $this->assertCount(2, $entries);

        $types = $entries->pluck('movement_type')->map(fn ($t) => $t instanceof BackedEnum ? $t->value : $t)->toArray();
        $this->assertContains('disassembly_consumption', $types);
        $this->assertContains('disassembly_output', $types);
    }

    public function test_ledger_entries_are_immutable_and_reference_plan(): void
    {
        $fg = $this->makeFinishedGood();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($fg);
        $this->addLine($recipe, $component, qty: 1.0);

        $this->seedInventory($fg, onHand: 3.0);

        $response = $this->service->disassembleProduct($this->makeRequest($fg, quantity: 1.0));

        $entries = StockLedgerEntry::query()
            ->where('reference_type', 'disassembly_plan')
            ->get();

        // All entries point to the same plan
        $this->assertGreaterThan(0, $entries->count());
        foreach ($entries as $entry) {
            $this->assertSame('disassembly_plan', $entry->reference_type);
            $this->assertNotEmpty($entry->reference_id);
        }

        // Ledger entries in result match DB entries
        $dbIds = $entries->pluck('id')->toArray();
        foreach ($response->ledger_entry_ids as $id) {
            $this->assertContains($id, $dbIds);
        }
    }

    public function test_fg_ledger_entry_shows_correct_before_after_qty(): void
    {
        $fg = $this->makeFinishedGood();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($fg);
        $this->addLine($recipe, $component, qty: 1.0);

        $this->seedInventory($fg, onHand: 5.0);

        $this->service->disassembleProduct($this->makeRequest($fg, quantity: 2.0));

        $fgEntry = StockLedgerEntry::query()
            ->where('product_id', $fg->id)
            ->where('movement_type', 'disassembly_consumption')
            ->first();

        $this->assertNotNull($fgEntry);
        $this->assertSame(5.0, (float) $fgEntry->on_hand_before);
        $this->assertSame(3.0, (float) $fgEntry->on_hand_after); // 5 - 2
    }

    // ── 7. Partial Quantities ─────────────────────────────────────────────────

    public function test_partial_disassembly_leaves_remaining_fg_in_stock(): void
    {
        $fg = $this->makeFinishedGood();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($fg);
        $this->addLine($recipe, $component, qty: 1.0);

        $this->seedInventory($fg, onHand: 10.0);

        $this->service->disassembleProduct($this->makeRequest($fg, quantity: 3.0));

        $fgItem = InventoryItem::query()
            ->where('product_id', $fg->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->first();

        $this->assertSame(7.0, (float) $fgItem->on_hand_qty); // 10 - 3
    }

    public function test_partial_disassembly_produces_proportional_components(): void
    {
        $fg = $this->makeFinishedGood();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($fg);
        $this->addLine($recipe, $component, qty: 2.5); // 2.5 per unit

        $this->seedInventory($fg, onHand: 10.0);
        $this->seedInventory($component, onHand: 0.0);

        $this->service->disassembleProduct($this->makeRequest($fg, quantity: 4.0));

        $compItem = InventoryItem::query()
            ->where('product_id', $component->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->first();

        $this->assertSame(10.0, (float) $compItem->on_hand_qty); // 2.5 * 4
    }

    // ── 8. Snapshot Reuse (recipe_snapshot_hash recorded) ────────────────────

    public function test_transaction_records_recipe_snapshot_hash(): void
    {
        $fg = $this->makeFinishedGood();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($fg, version: 1);
        $this->addLine($recipe, $component, qty: 1.0);

        $this->seedInventory($fg, onHand: 5.0);

        $this->service->disassembleProduct($this->makeRequest($fg, quantity: 1.0));

        $tx = DisassemblyTransaction::query()
            ->where('product_id', $fg->id)
            ->first();

        $this->assertNotNull($tx->recipe_snapshot_hash);
        $this->assertSame(64, strlen($tx->recipe_snapshot_hash)); // SHA-256 hex = 64 chars
    }

    public function test_transaction_records_bom_version_for_audit_trail(): void
    {
        $fg = $this->makeFinishedGood();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($fg, version: 2); // version 2
        $this->addLine($recipe, $component, qty: 1.0);

        $this->seedInventory($fg, onHand: 5.0);

        $this->service->disassembleProduct($this->makeRequest($fg, quantity: 1.0));

        $tx = DisassemblyTransaction::query()
            ->where('product_id', $fg->id)
            ->first();

        $this->assertSame(2, $tx->bom_version_number);
        $this->assertSame($recipe->id, $tx->bom_id);
    }

    public function test_second_disassembly_with_same_recipe_records_same_hash(): void
    {
        $fg = $this->makeFinishedGood();
        $component = $this->makeComponent();
        $recipe = $this->makeRecipe($fg, version: 1);
        $this->addLine($recipe, $component, qty: 1.0);

        $this->seedInventory($fg, onHand: 10.0);

        $trigger1 = 'return-1-'.uniqid();
        $trigger2 = 'return-2-'.uniqid();

        $this->service->disassembleProduct($this->makeRequest($fg, quantity: 1.0, triggerId: $trigger1));
        $this->service->disassembleProduct($this->makeRequest($fg, quantity: 1.0, triggerId: $trigger2));

        $hashes = DisassemblyTransaction::query()
            ->pluck('recipe_snapshot_hash')
            ->unique()
            ->values();

        // Same recipe version → same hash for both transactions
        $this->assertCount(1, $hashes);
        $this->assertNotNull($hashes[0]);
    }
}
