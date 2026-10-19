<?php

declare(strict_types=1);

namespace Tests\Feature\Operations;

use BackedEnum;
use DateTimeImmutable;
use DateTimeInterface;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Modules\Commerce\Orders\Application\Actions\ShipOrderInventoryAction;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Inventory\DomainEvents\Events\InventoryTransferred;
use Modules\Inventory\DomainEvents\Events\WarehouseTransferCompleted;
use Modules\Inventory\InventoryItems\Application\Actions\ReserveStockAction;
use Modules\Inventory\InventoryItems\Application\DTO\StockOperationDTO;
use Modules\Inventory\InventoryItems\Domain\Contracts\InventoryItemRepositoryInterface;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\InventoryItems\Domain\Models\StockLedgerEntry;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryLayerConsumption;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryReceiptLayer;
use Modules\Manufacturing\AvailabilityEngine\Domain\Enums\ManufacturingEligibility;
use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeComponent;
use Modules\Manufacturing\BillsOfMaterials\Domain\ValueObjects\RecipeSnapshot;
use Modules\Manufacturing\DecisionKernel\Domain\Enums\DecisionType;
use Modules\Manufacturing\DecisionKernel\Domain\ValueObjects\DecisionReason;
use Modules\Manufacturing\ManufacturingExecution\Application\Services\ManufacturingExecutor;
use Modules\Manufacturing\ManufacturingExecution\Domain\Services\ExecutionPipeline;
use Modules\Manufacturing\ManufacturingExecution\Domain\ValueObjects\ManufacturingExecutionResult;
use Modules\Manufacturing\ManufacturingPlanner\Domain\ValueObjects\ComponentConsumptionPlan;
use Modules\Manufacturing\ManufacturingPlanner\Domain\ValueObjects\ManufacturingPlan;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\Sales\Customers\Domain\Models\Customer;
use Tests\TestCase;

/**
 * TASK-OPS-INTEGRATION-FINAL-001 — Mandatory certification scenarios.
 *
 * Scenario A: Manufacture → FG FIFO layer → Shipment → FIFO consume → PASS
 * Scenario B: Manufacture → Ledger balanced → PASS
 * Scenario C: Cross-company shipment → audit record references correct InventoryItem → PASS
 * Scenario D: Transfer events have Phase B ADR — no orphan events → PASS
 */
class OperationsIntegrationFinalCertTest extends TestCase
{
    use DatabaseTransactions;

    private ManufacturingExecutor $executor;

    private ExecutionPipeline $pipeline;

    private ShipOrderInventoryAction $shipAction;

    private ReserveStockAction $reserveAction;

    private InventoryItemRepositoryInterface $inventoryRepo;

    private Company $company;

    private Warehouse $warehouse;

    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->executor = app(ManufacturingExecutor::class);
        $this->pipeline = app(ExecutionPipeline::class);
        $this->shipAction = app(ShipOrderInventoryAction::class);
        $this->reserveAction = app(ReserveStockAction::class);
        $this->inventoryRepo = app(InventoryItemRepositoryInterface::class);

        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);
        $this->customer = Customer::factory()->create();
    }

    // ── Scenario A: Manufacture → FG FIFO layer → Shipment → FIFO consume ────

    /**
     * @test
     * Invariant: on_hand_qty == Σ(remaining_qty of open FIFO layers) after every manufacturing run.
     */
    public function scenario_a_manufacturing_creates_fg_fifo_layer(): void
    {
        [$output, $component] = $this->makeOutputWithComponent(unitCost: 20.0);

        $result = $this->runManufacturing($output, $component, qtyToManufacture: 5.0, componentQtyEach: 2.0);

        $this->assertTrue($result->success);

        $fgItem = InventoryItem::query()
            ->where('warehouse_id', $this->warehouse->id)
            ->where('product_id', $output->id)
            ->where('company_id', $this->company->id)
            ->first();

        $this->assertNotNull($fgItem, 'FG InventoryItem must exist after manufacturing');
        $this->assertSame(5.0, (float) $fgItem->on_hand_qty, 'FG on_hand_qty must equal qty_to_manufacture');

        // C-001 invariant: open FIFO layers must sum to on_hand_qty
        $layerSum = (float) InventoryReceiptLayer::query()
            ->where('product_id', $output->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->where('company_id', $this->company->id)
            ->where('remaining_qty', '>', 0)
            ->sum('remaining_qty');

        $this->assertSame(5.0, $layerSum, 'FIFO invariant: on_hand_qty must equal Σ(remaining_qty of open layers)');
    }

    /** @test */
    public function scenario_a_manufactured_fg_can_be_shipped_via_fifo_path(): void
    {
        [$output, $component] = $this->makeOutputWithComponent(unitCost: 20.0);
        $this->runManufacturing($output, $component, qtyToManufacture: 5.0, componentQtyEach: 2.0);

        // Reserve the manufactured FG so ShipStockAction guard (reserved_qty >= qty) is satisfied
        $this->reserveAction->execute(new StockOperationDTO(
            warehouse_id: $this->warehouse->id,
            product_id: $output->id,
            company_id: $this->company->id,
            quantity: 5.0,
            reference_type: 'sales_order',
            reference_id: 'test-order-1',
        ));

        $order = $this->makeShippableOrder($output, qty: 5.0, reservedQty: 5.0);

        $layerBefore = InventoryReceiptLayer::query()
            ->where('product_id', $output->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->where('company_id', $this->company->id)
            ->where('remaining_qty', '>', 0)
            ->first();
        $this->assertNotNull($layerBefore, 'FG FIFO layer must exist before shipment');
        $this->assertSame(5.0, (float) $layerBefore->remaining_qty);

        // Ship — must not throw (C-001 fix: FIFO layer exists for consumption)
        $this->shipAction->execute($order);

        $layerBefore->refresh();
        $this->assertSame(0.0, (float) $layerBefore->remaining_qty,
            'FIFO layer must be fully consumed by shipment');

        $consumptionRecord = InventoryLayerConsumption::query()
            ->where('product_id', $output->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->where('company_id', $this->company->id)
            ->first();
        $this->assertNotNull($consumptionRecord,
            'FIFO consumption audit record must be created at shipment');
        $this->assertSame(5.0, (float) $consumptionRecord->quantity);
    }

    /** @test */
    public function scenario_a_fg_fifo_layer_cost_reflects_weighted_average_component_cost(): void
    {
        $output = Product::factory()->finishedGood()->manufacturable()->create();
        $component = Product::factory()->rawMaterial()->create(['allow_negative_stock' => false]);

        // Two RM layers at different costs: 5@10 + 5@30 = 200 total, 10 units
        $this->seedInventoryItem($component, onHand: 10.0);
        $this->seedReceiptLayer($component, qty: 5.0, cost: 10.0);
        $this->seedReceiptLayer($component, qty: 5.0, cost: 30.0, offsetSeconds: 1);

        // Recipe: 1 RM per FG, manufacture 10 → consumes 5@10 + 5@30, unit cost = 20.0
        $result = $this->runManufacturing($output, $component, qtyToManufacture: 10.0, componentQtyEach: 1.0);

        $this->assertTrue($result->success);

        $fgLayer = InventoryReceiptLayer::query()
            ->where('product_id', $output->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->where('company_id', $this->company->id)
            ->first();

        $this->assertNotNull($fgLayer);
        $this->assertSame(20.0, (float) $fgLayer->landed_unit_cost,
            'FG FIFO layer unit cost must be weighted average: (5×10 + 5×30) / 10 = 20.0');
        $this->assertSame(10.0, (float) $fgLayer->remaining_qty);
    }

    // ── Scenario B: Manufacture → Reservation → Shipment → Ledger balanced ───

    /** @test */
    public function scenario_b_manufacture_and_ship_ledger_is_balanced(): void
    {
        [$output, $component] = $this->makeOutputWithComponent(unitCost: 15.0);
        $this->runManufacturing($output, $component, qtyToManufacture: 3.0, componentQtyEach: 2.0);

        $this->reserveAction->execute(new StockOperationDTO(
            warehouse_id: $this->warehouse->id,
            product_id: $output->id,
            company_id: $this->company->id,
            quantity: 3.0,
            reference_type: 'sales_order',
            reference_id: 'test-order-b',
        ));

        $fgItem = InventoryItem::query()
            ->where('product_id', $output->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->where('company_id', $this->company->id)
            ->first();

        $this->assertSame(3.0, (float) $fgItem->on_hand_qty);
        $this->assertSame(3.0, (float) $fgItem->reserved_qty);

        $order = $this->makeShippableOrder($output, qty: 3.0, reservedQty: 3.0);
        $this->shipAction->execute($order);

        $fgItem->refresh();
        $this->assertSame(0.0, (float) $fgItem->on_hand_qty, 'on_hand_qty must be 0 after full shipment');
        $this->assertSame(0.0, (float) $fgItem->reserved_qty, 'reserved_qty must be 0 after full shipment');

        // Ledger entries: ProductionOutput + Reservation (= 'reservation') + SalesIssue all present
        $ledgerTypes = StockLedgerEntry::query()
            ->where('product_id', $output->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->pluck('movement_type')
            ->map(fn ($t) => $t instanceof BackedEnum ? $t->value : (string) $t)
            ->toArray();

        $this->assertContains('production_output', $ledgerTypes, 'ProductionOutput ledger entry must exist');
        $this->assertContains('reservation', $ledgerTypes, 'Reservation ledger entry must exist');
        $this->assertContains('sales_issue', $ledgerTypes, 'SalesIssue ledger entry must exist');

        // FIFO invariant: no open layers after full consumption
        $openLayerSum = (float) InventoryReceiptLayer::query()
            ->where('product_id', $output->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->where('company_id', $this->company->id)
            ->where('remaining_qty', '>', 0)
            ->sum('remaining_qty');

        $this->assertSame(0.0, $openLayerSum,
            'FIFO invariant: no open layers must remain after full shipment');
    }

    // ── Scenario C: Cross-company shipment → correct InventoryItem in audit ───

    /** @test */
    public function scenario_c_shipment_references_correct_company_inventory_item(): void
    {
        $product = Product::factory()->create();

        // Company A's InventoryItem
        $itemA = InventoryItem::query()->create([
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $product->id,
            'company_id' => $this->company->id,
            'on_hand_qty' => 10.0,
            'reserved_qty' => 5.0,
        ]);

        $this->seedReceiptLayer($product, qty: 10.0, cost: 25.0);

        $order = $this->makeShippableOrder($product, qty: 5.0, reservedQty: 5.0);
        $this->shipAction->execute($order);

        $consumption = InventoryLayerConsumption::query()
            ->where('product_id', $product->id)
            ->where('company_id', $this->company->id)
            ->first();

        $this->assertNotNull($consumption, 'Layer consumption audit record must exist');
        $this->assertSame($itemA->id, $consumption->inventory_item_id,
            'C-002: audit record must reference the correct company InventoryItem');
    }

    /** @test */
    public function scenario_c_company_scoped_lookup_returns_null_when_no_item_exists(): void
    {
        $product = Product::factory()->create();
        $companyB = Company::factory()->create();

        $item = $this->inventoryRepo->findByWarehouseProductAndCompany(
            $this->warehouse->id,
            $product->id,
            $companyB->id,
        );

        $this->assertNull($item,
            'findByWarehouseProductAndCompany must return null for unknown company');
    }

    // ── Scenario D: Transfer events → Phase B ADR confirmed ──────────────────

    /** @test */
    public function scenario_d_inventory_transferred_event_has_no_registered_listener(): void
    {
        $listeners = Event::getListeners(InventoryTransferred::class);
        $this->assertCount(0, $listeners,
            'C-003 / ADR-026: InventoryTransferred must have no listener in Phase A. '.
            'Register in Phase B — see docs/adr/ADR-026-transfer-events-phase-b.md');
    }

    /** @test */
    public function scenario_d_warehouse_transfer_completed_event_has_no_registered_listener(): void
    {
        $listeners = Event::getListeners(WarehouseTransferCompleted::class);
        $this->assertCount(0, $listeners,
            'C-003 / ADR-026: WarehouseTransferCompleted must have no listener in Phase A.');
    }

    /** @test */
    public function scenario_d_adr_026_document_exists_at_project_level(): void
    {
        // Check both: inside base_path() and one directory up (project root if backend/ is a subdir)
        $candidates = [
            base_path('docs/adr/ADR-026-transfer-events-phase-b.md'),
            dirname(base_path()).DIRECTORY_SEPARATOR.'docs'.DIRECTORY_SEPARATOR.'adr'.DIRECTORY_SEPARATOR.'ADR-026-transfer-events-phase-b.md',
        ];

        $found = array_filter($candidates, 'file_exists');

        $this->assertNotEmpty($found,
            'ADR-026 must exist at docs/adr/ADR-026-transfer-events-phase-b.md '.
            '(checked: '.implode(', ', $candidates).')');
    }

    // ── Additional C-001 invariant tests ─────────────────────────────────────

    /** @test */
    public function fifo_invariant_holds_when_rm_has_no_receipt_layers(): void
    {
        $output = Product::factory()->finishedGood()->manufacturable()->create();
        $component = Product::factory()->rawMaterial()->create(['allow_negative_stock' => true]);

        $this->seedInventoryItem($component, onHand: 5.0);
        // No receipt layers seeded — consumeFifoLayers returns 0.0, FG layer cost = 0.0

        $result = $this->runManufacturing($output, $component, qtyToManufacture: 5.0, componentQtyEach: 1.0, allowNegative: true);

        $this->assertTrue($result->success);

        $fgLayer = InventoryReceiptLayer::query()
            ->where('product_id', $output->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->where('company_id', $this->company->id)
            ->first();

        $this->assertNotNull($fgLayer,
            'FG receipt layer must be created even when RM had no FIFO layers');
        $this->assertSame(5.0, (float) $fgLayer->remaining_qty);
        $this->assertSame(0.0, (float) $fgLayer->landed_unit_cost,
            'Unit cost must be 0.0 when no RM FIFO layers were consumed');

        $this->assertFifoInvariantHolds($output);
    }

    /** @test */
    public function fifo_invariant_holds_with_negative_stock_component(): void
    {
        $output = Product::factory()->finishedGood()->manufacturable()->create();
        $component = Product::factory()->rawMaterial()->create(['allow_negative_stock' => true]);

        $this->seedInventoryItem($component, onHand: 3.0);
        $this->seedReceiptLayer($component, qty: 3.0, cost: 12.0);

        // Need 10 RM, have 3 → goes negative; cost = (3×12)/10 = 3.6
        $result = $this->runManufacturing($output, $component, qtyToManufacture: 10.0, componentQtyEach: 1.0, allowNegative: true);

        $this->assertTrue($result->success);
        $this->assertTrue($result->consumed_components[0]->went_negative);

        $fgLayer = InventoryReceiptLayer::query()
            ->where('product_id', $output->id)
            ->where('company_id', $this->company->id)
            ->first();

        $this->assertNotNull($fgLayer);
        $this->assertSame(10.0, (float) $fgLayer->remaining_qty);
        $this->assertEqualsWithDelta(3.6, (float) $fgLayer->landed_unit_cost, 0.0001,
            'FG layer unit cost must be partial FIFO cost: (3×12)/10 = 3.6');

        $this->assertFifoInvariantHolds($output);
    }

    /** @test */
    public function idempotent_manufacturing_does_not_create_duplicate_fg_fifo_layer(): void
    {
        [$output, $component] = $this->makeOutputWithComponent(unitCost: 10.0);

        $plan = $this->buildPlan($output, $component, qtyToConsume: 5.0, qtyToManufacture: 5.0);
        $context = $this->pipeline->prepare($plan);

        $this->executor->execute($context, $this->company->id); // first execution
        $this->executor->execute($context, $this->company->id); // idempotent replay

        $fgLayerCount = InventoryReceiptLayer::query()
            ->where('product_id', $output->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->where('company_id', $this->company->id)
            ->count();

        $this->assertSame(1, $fgLayerCount,
            'Idempotent replay must not create a second FG FIFO receipt layer');
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /** @return array{Product, Product} */
    private function makeOutputWithComponent(float $unitCost = 10.0): array
    {
        $output = Product::factory()->finishedGood()->manufacturable()->create();
        $component = Product::factory()->rawMaterial()->create(['allow_negative_stock' => false]);

        $this->seedInventoryItem($component, onHand: 100.0);
        $this->seedReceiptLayer($component, qty: 100.0, cost: $unitCost);

        return [$output, $component];
    }

    private function runManufacturing(
        Product $output,
        Product $component,
        float $qtyToManufacture,
        float $componentQtyEach,
        bool $allowNegative = false,
    ): ManufacturingExecutionResult {
        $plan = $this->buildPlan(
            $output,
            $component,
            qtyToConsume: $componentQtyEach * $qtyToManufacture,
            qtyToManufacture: $qtyToManufacture,
            allowNegative: $allowNegative,
        );
        $context = $this->pipeline->prepare($plan);

        return $this->executor->execute($context, $this->company->id);
    }

    private function buildPlan(
        Product $output,
        Product $component,
        float $qtyToConsume,
        float $qtyToManufacture,
        bool $allowNegative = false,
    ): ManufacturingPlan {
        $recipeId = Str::uuid()->toString();
        $planId = Str::uuid()->toString();

        $snapshot = new RecipeSnapshot(
            recipe_id: $recipeId,
            bom_number: 'BOM-'.Str::random(8),
            version: '1.0',
            bom_version_number: 1,
            product_id: $output->id,
            product_sku: $output->sku,
            product_name: $output->name,
            components: [
                new RecipeComponent(
                    component_id: $component->id,
                    sku: $component->sku,
                    name: $component->name,
                    unit_id: 'unit-cert',
                    unit_name: 'Unit',
                    unit_symbol: 'u',
                    quantity: $qtyToManufacture > 0
                        ? $qtyToConsume / $qtyToManufacture
                        : $qtyToConsume,
                    allow_negative_stock: $allowNegative,
                ),
            ],
            resolved_at: (new DateTimeImmutable)->format(DateTimeInterface::ATOM),
        );

        $hash = hash('sha256', json_encode($snapshot->toArray(), JSON_THROW_ON_ERROR));

        $availableQty = (float) (InventoryItem::query()
            ->where('product_id', $component->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->value('on_hand_qty') ?? 0);

        $missingQty = max(0.0, $qtyToConsume - $availableQty);

        return new ManufacturingPlan(
            plan_id: $planId,
            product_id: $output->id,
            warehouse_id: $this->warehouse->id,
            product_sku: $output->sku,
            product_name: $output->name,
            qty_to_manufacture: $qtyToManufacture,
            finished_goods_to_produce: $qtyToManufacture,
            available_finished_goods: 0.0,
            recipe_id: $recipeId,
            bom_version_number: 1,
            recipe_snapshot: $snapshot,
            recipe_snapshot_hash: $hash,
            components: [
                new ComponentConsumptionPlan(
                    component_id: $component->id,
                    sku: $component->sku,
                    name: $component->name,
                    unit_symbol: 'u',
                    qty_to_consume: $qtyToConsume,
                    available_qty: $availableQty,
                    missing_qty: $missingQty,
                    allow_negative_stock: $allowNegative,
                    will_go_negative: $allowNegative && $missingQty > 0.0,
                    is_blocked: false,
                ),
            ],
            negative_stock_decisions: [],
            eligibility: ManufacturingEligibility::CanManufacture,
            can_proceed: true,
            should_manufacture: true,
            decision_type: DecisionType::Approve,
            decision_reason: new DecisionReason(code: 'approved', message: 'Approved'),
            planned_at: (new DateTimeImmutable)->format(DateTimeInterface::ATOM),
            metadata: [],
        );
    }

    private function makeShippableOrder(Product $product, float $qty, float $reservedQty): Order
    {
        $order = Order::create([
            'customer_id' => $this->customer->id,
            'assigned_warehouse_id' => $this->warehouse->id,
            'order_number' => 'CERT-'.Str::random(8),
            'order_date' => now()->toDateString(),
            'status' => OrderStatus::InProgress->value,
            'inventory_reserved_at' => now(),
            'subtotal' => $qty * 100,
            'total' => $qty * 100,
        ]);

        $order->lines()->create([
            'product_id' => $product->id,
            'quantity' => $qty,
            'reserved_qty' => $reservedQty,
            'unit_price' => 100.0,
            'line_total' => $qty * 100,
        ]);

        return $order->load('lines', 'assignedWarehouse');
    }

    private function seedInventoryItem(Product $product, float $onHand): void
    {
        InventoryItem::query()->create([
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $product->id,
            'company_id' => $this->company->id,
            'on_hand_qty' => $onHand,
            'reserved_qty' => 0.0,
        ]);
    }

    private function seedReceiptLayer(Product $product, float $qty, float $cost, int $offsetSeconds = 0): void
    {
        InventoryReceiptLayer::query()->create([
            'company_id' => $this->company->id,
            'product_id' => $product->id,
            'warehouse_id' => $this->warehouse->id,
            'received_qty' => $qty,
            'remaining_qty' => $qty,
            'landed_unit_cost' => $cost,
            'receipt_date' => now()->addSeconds($offsetSeconds),
        ]);
    }

    private function assertFifoInvariantHolds(Product $product): void
    {
        $fgItem = InventoryItem::query()
            ->where('product_id', $product->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->where('company_id', $this->company->id)
            ->first();

        $layerSum = (float) InventoryReceiptLayer::query()
            ->where('product_id', $product->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->where('company_id', $this->company->id)
            ->where('remaining_qty', '>', 0)
            ->sum('remaining_qty');

        $this->assertEqualsWithDelta(
            (float) $fgItem->on_hand_qty,
            $layerSum,
            0.0001,
            "FIFO invariant violated: on_hand_qty={$fgItem->on_hand_qty} != Σ remaining_qty={$layerSum}",
        );
    }
}
