<?php

declare(strict_types=1);

namespace Tests\Feature\Manufacturing;

use BackedEnum;
use DateTimeImmutable;
use DateTimeInterface;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\InventoryItems\Domain\Models\StockLedgerEntry;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryLayerConsumption;
use Modules\Manufacturing\AvailabilityEngine\Domain\Enums\ManufacturingEligibility;
use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeComponent;
use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeSnapshot;
use Modules\Manufacturing\DecisionKernel\Domain\Enums\DecisionType;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionReason;
use Modules\Manufacturing\ManufacturingExecution\Application\Services\ManufacturingExecutor;
use Modules\Manufacturing\ManufacturingExecution\Domain\Contracts\InventoryMutationInterface;
use Modules\Manufacturing\ManufacturingExecution\Domain\Contracts\ManufacturingExecutorHooksInterface;
use Modules\Manufacturing\ManufacturingExecution\Domain\Contracts\ManufacturingTransactionRepositoryInterface;
use Modules\Manufacturing\ManufacturingExecution\Domain\Enums\TransactionStatus;
use Modules\Manufacturing\ManufacturingExecution\Domain\Exceptions\ExecutionException;
use Modules\Manufacturing\ManufacturingExecution\Domain\Models\ManufacturingTransaction;
use Modules\Manufacturing\ManufacturingExecution\Domain\Services\ExecutionPipeline;
use Modules\Manufacturing\ManufacturingExecution\Domain\ValueObjects\ManufacturingExecutionContext;
use Modules\Manufacturing\ManufacturingExecution\Domain\ValueObjects\ManufacturingExecutionResult;
use Modules\Manufacturing\ManufacturingPlanner\Domain\ValueObjects\ComponentConsumptionPlan;
use Modules\Manufacturing\ManufacturingPlanner\Domain\ValueObjects\ManufacturingPlan;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;
use RuntimeException;
use Tests\TestCase;
use Throwable;

/**
 * PKG-05B: ManufacturingExecutor — feature tests (real DB).
 *
 * Tests actual execution via ManufacturingExecutionContext:
 *   - Inventory mutations (on_hand_qty decrements/increments)
 *   - Immutable ledger entries (ProductionConsumption + ProductionOutput)
 *   - FIFO layer consumption (InventoryLayerConsumption audit records)
 *   - ManufacturingTransaction as source of truth
 *   - Idempotency (plan_id UNIQUE constraint)
 *   - Full transaction rollback
 *   - Invalid context guard
 *   - Lifecycle hooks
 *   - Context identifier propagation (execution_uuid, decision_key, correlation_id)
 */
class ManufacturingExecutorTest extends TestCase
{
    use DatabaseTransactions;

    private ManufacturingExecutor $executor;

    private ExecutionPipeline $pipeline;

    private Company $company;

    private Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();
        $this->executor = app(ManufacturingExecutor::class);
        $this->pipeline = app(ExecutionPipeline::class);
        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

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

    private function makeRecipeSnapshot(Product $output, array $componentProducts, array $quantities): RecipeSnapshot
    {
        $components = [];
        foreach ($componentProducts as $i => $product) {
            $components[] = new RecipeComponent(
                component_id: $product->id,
                sku: $product->sku,
                name: $product->name,
                unit_id: 'unit-001',
                unit_name: 'Kilogram',
                unit_symbol: 'kg',
                quantity: $quantities[$i] ?? 1.0,
                allow_negative_stock: (bool) $product->allow_negative_stock,
            );
        }

        return new RecipeSnapshot(
            recipe_id: 'recipe-'.uniqid(),
            bom_number: 'BOM-'.uniqid(),
            version: '1.0',
            bom_version_number: 1,
            product_id: $output->id,
            product_sku: $output->sku,
            product_name: $output->name,
            components: $components,
            resolved_at: (new DateTimeImmutable)->format(DateTimeInterface::ATOM),
        );
    }

    private function makeComponentPlan(
        Product $component,
        float $qtyToConsume,
        float $availableQty,
        bool $allowNegative = false,
    ): ComponentConsumptionPlan {
        $missing = max(0.0, $qtyToConsume - $availableQty);

        return new ComponentConsumptionPlan(
            component_id: $component->id,
            sku: $component->sku,
            name: $component->name,
            unit_symbol: 'kg',
            qty_to_consume: $qtyToConsume,
            available_qty: $availableQty,
            missing_qty: $missing,
            allow_negative_stock: $allowNegative,
            will_go_negative: $missing > 0.0 && $allowNegative,
            is_blocked: $missing > 0.0 && ! $allowNegative,
        );
    }

    private function buildPlan(
        Product $output,
        RecipeSnapshot $snapshot,
        array $components,
        float $qtyToManufacture,
        bool $shouldManufacture = true,
        ?string $overrideHash = null,
    ): ManufacturingPlan {
        $hash = $overrideHash ?? hash('sha256', json_encode($snapshot->toArray(), JSON_THROW_ON_ERROR));

        return new ManufacturingPlan(
            plan_id: $this->generateUuid(),
            product_id: $output->id,
            warehouse_id: $this->warehouse->id,
            product_sku: $output->sku,
            product_name: $output->name,
            qty_to_manufacture: $qtyToManufacture,
            finished_goods_to_produce: $qtyToManufacture,
            available_finished_goods: 0.0,
            recipe_id: $snapshot->recipe_id,
            bom_version_number: $snapshot->bom_version_number,
            recipe_snapshot: $snapshot,
            recipe_snapshot_hash: $hash,
            components: $components,
            negative_stock_decisions: [],
            eligibility: ManufacturingEligibility::CanManufacture,
            can_proceed: $shouldManufacture,
            should_manufacture: $shouldManufacture,
            decision_type: DecisionType::Approve,
            decision_reason: new DecisionReason(code: 'mfg_approved', message: 'Approved'),
            planned_at: (new DateTimeImmutable)->format(DateTimeInterface::ATOM),
            metadata: ['correlation_id' => $this->generateUuid()],
        );
    }

    /** Build a valid ManufacturingExecutionContext through the real Pipeline. */
    private function buildContext(ManufacturingPlan $plan, bool $alreadyExecuted = false): ManufacturingExecutionContext
    {
        return $this->pipeline->prepare($plan, alreadyExecuted: $alreadyExecuted);
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

    /**
     * Seed a receipt layer so FIFO tracking has something to consume.
     * Returns the created layer.
     */
    private function seedReceiptLayer(Product $product, float $qty, float $unitCost = 10.0): \Modules\Inventory\ReceiptLayers\Domain\Models\InventoryReceiptLayer
    {
        return \Modules\Inventory\ReceiptLayers\Domain\Models\InventoryReceiptLayer::query()->create([
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouse->id,
            'company_id' => $this->company->id,
            'received_qty' => $qty,
            'remaining_qty' => $qty,
            'landed_unit_cost' => $unitCost,
            'receipt_date' => now(),
        ]);
    }

    private function generateUuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0F | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3F | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    // ── 1. Successful Execution ───────────────────────────────────────────────

    public function test_successful_execution_decrements_raw_material_stock(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [2.0]);

        $this->seedInventory($component, onHand: 20.0);
        $componentPlan = $this->makeComponentPlan($component, qtyToConsume: 10.0, availableQty: 20.0);
        $plan = $this->buildPlan($output, $snapshot, [$componentPlan], qtyToManufacture: 5.0);
        $context = $this->buildContext($plan);

        $this->assertTrue($context->isValid());
        $this->executor->execute($context, $this->company->id);

        $item = InventoryItem::query()
            ->where('warehouse_id', $this->warehouse->id)
            ->where('product_id', $component->id)
            ->first();

        $this->assertSame(10.0, (float) $item->on_hand_qty); // 20 - 10
    }

    public function test_successful_execution_increments_finished_goods_stock(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [1.0]);

        $this->seedInventory($component, onHand: 10.0);
        $this->seedInventory($output, onHand: 3.0);
        $componentPlan = $this->makeComponentPlan($component, qtyToConsume: 5.0, availableQty: 10.0);
        $plan = $this->buildPlan($output, $snapshot, [$componentPlan], qtyToManufacture: 5.0);
        $context = $this->buildContext($plan);

        $this->executor->execute($context, $this->company->id);

        $fgItem = InventoryItem::query()
            ->where('warehouse_id', $this->warehouse->id)
            ->where('product_id', $output->id)
            ->first();

        $this->assertSame(8.0, (float) $fgItem->on_hand_qty); // 3 + 5
    }

    public function test_successful_execution_creates_ledger_entries(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [2.0]);

        $this->seedInventory($component, onHand: 20.0);
        $componentPlan = $this->makeComponentPlan($component, qtyToConsume: 10.0, availableQty: 20.0);
        $plan = $this->buildPlan($output, $snapshot, [$componentPlan], qtyToManufacture: 5.0);
        $context = $this->buildContext($plan);

        $result = $this->executor->execute($context, $this->company->id);

        $this->assertCount(2, $result->ledger_entry_ids); // 1 consumption + 1 production

        $entries = StockLedgerEntry::query()
            ->where('reference_type', 'manufacturing_plan')
            ->where('reference_id', $plan->plan_id)
            ->get();

        $this->assertCount(2, $entries);
        $types = $entries->pluck('movement_type')->map(fn ($t) => $t instanceof BackedEnum ? $t->value : $t)->toArray();
        $this->assertContains('production_consumption', $types);
        $this->assertContains('production_output', $types);
    }

    public function test_successful_execution_creates_manufacturing_transaction(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [1.0]);

        $this->seedInventory($component, onHand: 10.0);
        $componentPlan = $this->makeComponentPlan($component, qtyToConsume: 5.0, availableQty: 10.0);
        $plan = $this->buildPlan($output, $snapshot, [$componentPlan], qtyToManufacture: 5.0);
        $context = $this->buildContext($plan);

        $result = $this->executor->execute($context, $this->company->id);

        $tx = ManufacturingTransaction::query()->where('plan_id', $plan->plan_id)->first();
        $this->assertNotNull($tx);
        $this->assertSame(TransactionStatus::Completed, $tx->status);
        $this->assertSame(5.0, (float) $tx->qty_produced);
        $this->assertSame($snapshot->recipe_id, $tx->bom_id);
        $this->assertSame($plan->recipe_snapshot_hash, $tx->recipe_snapshot_hash);
        $this->assertSame($result->transaction_id, $tx->id);
    }

    public function test_successful_execution_result_structure(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [1.0]);

        $this->seedInventory($component, onHand: 10.0);
        $componentPlan = $this->makeComponentPlan($component, qtyToConsume: 5.0, availableQty: 10.0);
        $plan = $this->buildPlan($output, $snapshot, [$componentPlan], qtyToManufacture: 5.0);
        $context = $this->buildContext($plan);

        $result = $this->executor->execute($context, $this->company->id);

        $this->assertTrue($result->success);
        $this->assertFalse($result->was_idempotent);
        $this->assertSame(5.0, $result->qty_produced);
        $this->assertCount(1, $result->consumed_components);
        $this->assertSame($component->id, $result->consumed_components[0]->component_id);
        $this->assertGreaterThanOrEqual(0, $result->duration_ms);
        $this->assertNotEmpty($result->execution_id);
        $this->assertNotEmpty($result->transaction_id);
    }

    public function test_execution_creates_fg_inventory_item_when_none_exists(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [1.0]);

        $this->seedInventory($component, onHand: 10.0);
        // No FG row — executor creates it via findOrCreate
        $componentPlan = $this->makeComponentPlan($component, qtyToConsume: 5.0, availableQty: 10.0);
        $plan = $this->buildPlan($output, $snapshot, [$componentPlan], qtyToManufacture: 5.0);
        $context = $this->buildContext($plan);

        $this->executor->execute($context, $this->company->id);

        $fgItem = InventoryItem::query()
            ->where('product_id', $output->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->first();

        $this->assertNotNull($fgItem);
        $this->assertSame(5.0, (float) $fgItem->on_hand_qty);
    }

    public function test_multiple_components_all_consumed(): void
    {
        $output = $this->makeOutput();
        $mat1 = $this->makeComponent();
        $mat2 = $this->makeComponent();
        $snapshot = $this->makeRecipeSnapshot($output, [$mat1, $mat2], [2.0, 3.0]);

        $this->seedInventory($mat1, onHand: 20.0);
        $this->seedInventory($mat2, onHand: 30.0);

        $plan = $this->buildPlan($output, $snapshot, [
            $this->makeComponentPlan($mat1, qtyToConsume: 10.0, availableQty: 20.0),
            $this->makeComponentPlan($mat2, qtyToConsume: 15.0, availableQty: 30.0),
        ], qtyToManufacture: 5.0);
        $context = $this->buildContext($plan);

        $result = $this->executor->execute($context, $this->company->id);

        $this->assertCount(2, $result->consumed_components);
        $this->assertCount(3, $result->ledger_entry_ids); // 2 consumption + 1 production

        $mat1Item = InventoryItem::query()->where('product_id', $mat1->id)->first();
        $mat2Item = InventoryItem::query()->where('product_id', $mat2->id)->first();
        $this->assertSame(10.0, (float) $mat1Item->on_hand_qty); // 20 - 10
        $this->assertSame(15.0, (float) $mat2Item->on_hand_qty); // 30 - 15
    }

    // ── 2. Context Identifier Propagation ────────────────────────────────────

    public function test_context_execution_uuid_used_as_execution_id_in_result(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [1.0]);

        $this->seedInventory($component, onHand: 10.0);
        $plan = $this->buildPlan($output, $snapshot,
            [$this->makeComponentPlan($component, 5.0, 10.0)], 5.0);
        $context = $this->buildContext($plan);

        $result = $this->executor->execute($context, $this->company->id);

        $this->assertSame($context->execution_uuid, $result->execution_id);
    }

    public function test_decision_key_stored_in_manufacturing_transaction(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [1.0]);

        $this->seedInventory($component, onHand: 10.0);
        $plan = $this->buildPlan($output, $snapshot,
            [$this->makeComponentPlan($component, 5.0, 10.0)], 5.0);
        $context = $this->buildContext($plan);

        $this->executor->execute($context, $this->company->id);

        $tx = ManufacturingTransaction::query()->where('plan_id', $plan->plan_id)->first();
        $this->assertNotNull($tx->decision_key);
        $this->assertSame($context->decision_key, $tx->decision_key);
    }

    public function test_correlation_id_stored_in_manufacturing_transaction(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [1.0]);

        $this->seedInventory($component, onHand: 10.0);
        $plan = $this->buildPlan($output, $snapshot,
            [$this->makeComponentPlan($component, 5.0, 10.0)], 5.0);
        $context = $this->buildContext($plan);

        $this->executor->execute($context, $this->company->id);

        $tx = ManufacturingTransaction::query()->where('plan_id', $plan->plan_id)->first();
        $this->assertNotNull($tx->correlation_id);
        $this->assertSame($context->correlation_id, $tx->correlation_id);
    }

    public function test_transaction_has_correct_bom_version_for_rc10(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [1.0]);

        $this->seedInventory($component, onHand: 20.0);
        $plan = $this->buildPlan($output, $snapshot,
            [$this->makeComponentPlan($component, 5.0, 20.0)], 5.0);
        $context = $this->buildContext($plan);

        $this->executor->execute($context, $this->company->id);

        $tx = ManufacturingTransaction::query()->where('plan_id', $plan->plan_id)->first();
        $this->assertSame(1, $tx->bom_version_number);
        $this->assertSame($snapshot->recipe_id, $tx->bom_id);
    }

    // ── 3. FIFO Layer Consumption ─────────────────────────────────────────────

    public function test_fifo_layer_consumption_records_created_during_execution(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [1.0]);

        $this->seedInventory($component, onHand: 10.0);
        $this->seedReceiptLayer($component, qty: 10.0, unitCost: 15.0);

        $plan = $this->buildPlan($output, $snapshot,
            [$this->makeComponentPlan($component, 6.0, 10.0)], 6.0);
        $context = $this->buildContext($plan);

        $this->executor->execute($context, $this->company->id);

        $layerAudits = InventoryLayerConsumption::query()
            ->where('product_id', $component->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->get();

        $this->assertCount(1, $layerAudits);
        $this->assertSame(6.0, (float) $layerAudits[0]->quantity);
        $this->assertSame(15.0, (float) $layerAudits[0]->unit_cost);
    }

    public function test_fifo_layer_remaining_qty_decremented_after_execution(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [1.0]);

        $this->seedInventory($component, onHand: 10.0);
        $layer = $this->seedReceiptLayer($component, qty: 10.0, unitCost: 10.0);

        $plan = $this->buildPlan($output, $snapshot,
            [$this->makeComponentPlan($component, 4.0, 10.0)], 4.0);
        $context = $this->buildContext($plan);

        $this->executor->execute($context, $this->company->id);

        $layer->refresh();
        $this->assertSame(6.0, (float) $layer->remaining_qty); // 10 - 4
    }

    public function test_multiple_fifo_layers_consumed_in_chronological_order(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [1.0]);

        $this->seedInventory($component, onHand: 20.0);
        $layer1 = $this->seedReceiptLayer($component, qty: 5.0, unitCost: 10.0);
        $layer2 = $this->seedReceiptLayer($component, qty: 15.0, unitCost: 12.0);

        // Consume 8: should exhaust layer1 (5) then take 3 from layer2
        $plan = $this->buildPlan($output, $snapshot,
            [$this->makeComponentPlan($component, 8.0, 20.0)], 8.0);
        $context = $this->buildContext($plan);

        $this->executor->execute($context, $this->company->id);

        $layer1->refresh();
        $layer2->refresh();
        $this->assertSame(0.0, (float) $layer1->remaining_qty); // exhausted
        $this->assertSame(12.0, (float) $layer2->remaining_qty); // 15 - 3
    }

    // ── 4. Negative Stock Execution (RC-2) ────────────────────────────────────

    public function test_execution_with_negative_stock_component_goes_below_zero(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent(allowNegative: true);
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [1.0]);

        $this->seedInventory($component, onHand: 3.0);
        $plan = $this->buildPlan($output, $snapshot,
            [$this->makeComponentPlan($component, 10.0, 3.0, allowNegative: true)], 10.0);
        $context = $this->buildContext($plan);

        $result = $this->executor->execute($context, $this->company->id);

        $this->assertTrue($result->success);
        $this->assertTrue($result->consumed_components[0]->went_negative);
        $this->assertSame(-7.0, $result->consumed_components[0]->on_hand_after);

        $item = InventoryItem::query()
            ->where('product_id', $component->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->first();
        $this->assertSame(-7.0, (float) $item->on_hand_qty);
    }

    public function test_negative_stock_partial_fifo_consume_exhausts_available_layers(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent(allowNegative: true);
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [1.0]);

        $this->seedInventory($component, onHand: 3.0);
        $layer = $this->seedReceiptLayer($component, qty: 3.0, unitCost: 10.0);

        // Consume 10, only 3 in FIFO layers — should partially consume 3
        $plan = $this->buildPlan($output, $snapshot,
            [$this->makeComponentPlan($component, 10.0, 3.0, allowNegative: true)], 10.0);
        $context = $this->buildContext($plan);

        $this->executor->execute($context, $this->company->id);

        $layer->refresh();
        $this->assertSame(0.0, (float) $layer->remaining_qty); // fully exhausted

        // Layer audit exists for the partial 3 units
        $audits = InventoryLayerConsumption::query()
            ->where('product_id', $component->id)
            ->get();
        $this->assertCount(1, $audits);
        $this->assertSame(3.0, (float) $audits[0]->quantity);
    }

    public function test_negative_stock_with_no_fifo_layers_skips_layer_tracking(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent(allowNegative: true);
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [1.0]);

        // No receipt layers seeded — nothing to consume via FIFO
        $this->seedInventory($component, onHand: 3.0);
        $plan = $this->buildPlan($output, $snapshot,
            [$this->makeComponentPlan($component, 10.0, 3.0, allowNegative: true)], 10.0);
        $context = $this->buildContext($plan);

        // Should not throw — FIFO tracking silently skipped for zero-layer case
        $result = $this->executor->execute($context, $this->company->id);

        $this->assertTrue($result->success);
        $this->assertCount(0, InventoryLayerConsumption::query()->get());
    }

    // ── 5. Idempotency ────────────────────────────────────────────────────────

    public function test_duplicate_execution_returns_idempotent_result(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [1.0]);

        $this->seedInventory($component, onHand: 20.0);
        $plan = $this->buildPlan($output, $snapshot,
            [$this->makeComponentPlan($component, 5.0, 20.0)], 5.0);
        $context = $this->buildContext($plan);

        $result1 = $this->executor->execute($context, $this->company->id);
        $result2 = $this->executor->execute($context, $this->company->id); // same plan_id

        $this->assertTrue($result2->was_idempotent);
        $this->assertSame($result1->transaction_id, $result2->transaction_id);
    }

    public function test_idempotent_execution_does_not_double_consume_inventory(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [1.0]);

        $this->seedInventory($component, onHand: 20.0);
        $plan = $this->buildPlan($output, $snapshot,
            [$this->makeComponentPlan($component, 5.0, 20.0)], 5.0);
        $context = $this->buildContext($plan);

        $this->executor->execute($context, $this->company->id);
        $this->executor->execute($context, $this->company->id);

        $item = InventoryItem::query()
            ->where('product_id', $component->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->first();

        $this->assertSame(15.0, (float) $item->on_hand_qty); // 20 - 5, not 20 - 10
    }

    public function test_idempotent_replay_uses_context_execution_uuid_not_transaction(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [1.0]);

        $this->seedInventory($component, onHand: 10.0);
        $plan = $this->buildPlan($output, $snapshot,
            [$this->makeComponentPlan($component, 5.0, 10.0)], 5.0);
        $context = $this->buildContext($plan);

        $this->executor->execute($context, $this->company->id);

        // Second call gets a fresh context (different execution_uuid)
        $context2 = $this->buildContext($plan, alreadyExecuted: false);
        $result2 = $this->executor->execute($context2, $this->company->id);

        $this->assertTrue($result2->was_idempotent);
        // execution_id in idempotent result is the context's UUID, not the original
        $this->assertSame($context2->execution_uuid, $result2->execution_id);
    }

    // ── 6. Rollback ───────────────────────────────────────────────────────────

    public function test_rollback_restores_inventory_on_transaction_failure(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [1.0]);

        $rawItem = $this->seedInventory($component, onHand: 20.0);
        $plan = $this->buildPlan($output, $snapshot,
            [$this->makeComponentPlan($component, 5.0, 20.0)], 5.0);
        $context = $this->buildContext($plan);

        $mockRepo = $this->createMock(ManufacturingTransactionRepositoryInterface::class);
        $mockRepo->method('findByPlanId')->willReturn(null);
        $mockRepo->method('save')->willThrowException(new RuntimeException('Simulated DB failure'));

        $executor = new ManufacturingExecutor(
            inventory: app(InventoryMutationInterface::class),
            transactions: $mockRepo,
        );

        try {
            $executor->execute($context, $this->company->id);
            $this->fail('Expected exception was not thrown');
        } catch (Throwable) {
            // Expected
        }

        $rawItem->refresh();
        $this->assertSame(20.0, (float) $rawItem->on_hand_qty);

        $entries = StockLedgerEntry::query()
            ->where('reference_type', 'manufacturing_plan')
            ->where('reference_id', $plan->plan_id)
            ->get();
        $this->assertCount(0, $entries);

        $tx = ManufacturingTransaction::query()->where('plan_id', $plan->plan_id)->first();
        $this->assertNull($tx);
    }

    public function test_rollback_restores_fifo_layers_on_transaction_failure(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [1.0]);

        $this->seedInventory($component, onHand: 10.0);
        $layer = $this->seedReceiptLayer($component, qty: 10.0, unitCost: 10.0);
        $plan = $this->buildPlan($output, $snapshot,
            [$this->makeComponentPlan($component, 5.0, 10.0)], 5.0);
        $context = $this->buildContext($plan);

        $mockRepo = $this->createMock(ManufacturingTransactionRepositoryInterface::class);
        $mockRepo->method('findByPlanId')->willReturn(null);
        $mockRepo->method('save')->willThrowException(new RuntimeException('Simulated DB failure'));

        $executor = new ManufacturingExecutor(
            inventory: app(InventoryMutationInterface::class),
            transactions: $mockRepo,
        );

        try {
            $executor->execute($context, $this->company->id);
        } catch (Throwable) {
        }

        // FIFO layers must be rolled back too
        $layer->refresh();
        $this->assertSame(10.0, (float) $layer->remaining_qty);
        $this->assertCount(0, InventoryLayerConsumption::query()->get());
    }

    // ── 7. Invalid Context Guard ──────────────────────────────────────────────

    public function test_invalid_context_throws_execution_exception(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [1.0]);

        // Override hash → SnapshotHashMismatch validation failure → context.isValid() = false
        $plan = $this->buildPlan($output, $snapshot,
            [$this->makeComponentPlan($component, 5.0, 10.0)], 5.0,
            overrideHash: str_repeat('0', 64));
        $context = $this->buildContext($plan);

        $this->assertFalse($context->isValid());

        $this->expectException(ExecutionException::class);
        $this->executor->execute($context, $this->company->id);
    }

    public function test_invalid_context_does_not_write_to_db(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [1.0]);

        $plan = $this->buildPlan($output, $snapshot,
            [$this->makeComponentPlan($component, 5.0, 10.0)], 5.0,
            overrideHash: str_repeat('0', 64));
        $context = $this->buildContext($plan);

        try {
            $this->executor->execute($context, $this->company->id);
        } catch (ExecutionException $e) {
            $this->assertSame(ExecutionException::INVALID_CONTEXT, $e->reason());
        }

        $this->assertDatabaseCount('manufacturing_transactions', 0);
        $this->assertDatabaseCount('stock_ledger_entries', 0);
    }

    // ── 8. Lifecycle Hooks ────────────────────────────────────────────────────

    public function test_lifecycle_hooks_called_in_correct_order_on_success(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [1.0]);

        $this->seedInventory($component, onHand: 10.0);
        $plan = $this->buildPlan($output, $snapshot,
            [$this->makeComponentPlan($component, 5.0, 10.0)], 5.0);
        $context = $this->buildContext($plan);

        $called = [];

        $hooks = new class($called) implements ManufacturingExecutorHooksInterface
        {
            public function __construct(private array &$called) {}

            public function onBeforeExecution(ManufacturingExecutionContext $c): void
            {
                $this->called[] = 'before';
            }

            public function onAfterInventoryConsumption(ManufacturingExecutionContext $c, array $r, array $l): void
            {
                $this->called[] = 'after_consumption';
            }

            public function onAfterFinishedGoodsCreated(ManufacturingExecutionContext $c, string $id): void
            {
                $this->called[] = 'after_fg';
            }

            public function onAfterCommit(ManufacturingExecutionResult $r): void
            {
                $this->called[] = 'after_commit';
            }

            public function onAfterRollback(ManufacturingExecutionContext $c, Throwable $e): void
            {
                $this->called[] = 'after_rollback';
            }
        };

        $executor = new ManufacturingExecutor(
            inventory: app(InventoryMutationInterface::class),
            transactions: app(ManufacturingTransactionRepositoryInterface::class),
            hooks: $hooks,
        );

        $executor->execute($context, $this->company->id);

        $this->assertSame(
            ['before', 'after_consumption', 'after_fg', 'after_commit'],
            $called,
        );
    }

    public function test_rollback_hook_called_and_exception_still_propagates(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [1.0]);

        $this->seedInventory($component, onHand: 10.0);
        $plan = $this->buildPlan($output, $snapshot,
            [$this->makeComponentPlan($component, 5.0, 10.0)], 5.0);
        $context = $this->buildContext($plan);

        $rollbackCalled = false;

        $hooks = new class($rollbackCalled) implements ManufacturingExecutorHooksInterface
        {
            public function __construct(private bool &$called) {}

            public function onBeforeExecution(ManufacturingExecutionContext $c): void {}

            public function onAfterInventoryConsumption(ManufacturingExecutionContext $c, array $r, array $l): void {}

            public function onAfterFinishedGoodsCreated(ManufacturingExecutionContext $c, string $id): void {}

            public function onAfterCommit(ManufacturingExecutionResult $r): void {}

            public function onAfterRollback(ManufacturingExecutionContext $c, Throwable $e): void
            {
                $this->called = true;
            }
        };

        $mockRepo = $this->createMock(ManufacturingTransactionRepositoryInterface::class);
        $mockRepo->method('findByPlanId')->willReturn(null);
        $mockRepo->method('save')->willThrowException(new RuntimeException('fail'));

        $executor = new ManufacturingExecutor(
            inventory: app(InventoryMutationInterface::class),
            transactions: $mockRepo,
            hooks: $hooks,
        );

        try {
            $executor->execute($context, $this->company->id);
            $this->fail('Exception expected');
        } catch (RuntimeException) {
        }

        $this->assertTrue($rollbackCalled);
    }

    public function test_hooks_are_optional_null_does_not_throw(): void
    {
        $output = $this->makeOutput();
        $component = $this->makeComponent();
        $snapshot = $this->makeRecipeSnapshot($output, [$component], [1.0]);

        $this->seedInventory($component, onHand: 10.0);
        $plan = $this->buildPlan($output, $snapshot,
            [$this->makeComponentPlan($component, 5.0, 10.0)], 5.0);
        $context = $this->buildContext($plan);

        // Default executor from container has null hooks
        $result = $this->executor->execute($context, $this->company->id);

        $this->assertTrue($result->success);
    }
}
