<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Modules\Inventory\CountSessions\Application\Actions\ApproveCountSessionAction;
use Modules\Inventory\CountSessions\Application\Actions\CompleteCountSessionAction;
use Modules\Inventory\CountSessions\Application\Actions\CreateCountSessionAction;
use Modules\Inventory\CountSessions\Application\Actions\StartCountSessionAction;
use Modules\Inventory\CountSessions\Domain\Models\InventoryCountLine;
use Modules\Inventory\CountSessions\Domain\Models\InventoryCountSession;
use Modules\Inventory\InventoryControl\Application\Services\AbcClassificationService;
use Modules\Inventory\InventoryControl\Domain\Enums\AbcClass;
use Modules\Inventory\InventoryControl\Domain\Models\CycleCountPlan;
use Modules\Inventory\InventoryControl\Domain\Models\InventoryAbcClassification;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryReceiptLayer;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\Purchasing\Suppliers\Domain\Models\Supplier;
use Tests\TestCase;

/**
 * COM-011A: ABC Inventory Classification Engine
 */
class InventoryAbcClassificationTest extends TestCase
{
    use RefreshDatabase;

    private Company $company;

    private Warehouse $warehouse;

    private Supplier $supplier;

    protected function setUp(): void
    {
        parent::setUp();
        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);
        $this->supplier = Supplier::factory()->create();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeProduct(): Product
    {
        return Product::factory()->create([
            'regular_price' => 100.0,
            'average_cost' => 50.0,
        ]);
    }

    private function seedItem(Product $product, float $onHand): InventoryItem
    {
        return InventoryItem::query()->create([
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $product->id,
            'company_id' => $this->company->id,
            'on_hand_qty' => $onHand,
            'reserved_qty' => 0,
        ]);
    }

    /**
     * Create a consumption record for the ABC service.
     *
     * The layer is created with nullable GR columns (since the 290000 migration
     * made goods_receipt_id / goods_receipt_line_id / supplier_id nullable),
     * so no extra Product factory calls occur and the product count stays clean.
     */
    private function addConsumption(
        InventoryItem $item,
        float $qty,
        float $cost,
        ?string $at = null,
    ): InventoryReceiptLayer {
        // Create a layer directly (no GoodsReceipt factory → no phantom products)
        $layer = InventoryReceiptLayer::query()->create([
            'company_id' => $this->company->id,
            'product_id' => $item->product_id,
            'warehouse_id' => $this->warehouse->id,
            'received_qty' => $qty,
            'remaining_qty' => 0,
            'landed_unit_cost' => $cost,
            'receipt_date' => now()->toDateString(),
        ]);

        \Illuminate\Support\Facades\DB::table('inventory_layer_consumptions')->insert([
            'id' => Str::uuid()->toString(),
            'inventory_item_id' => $item->id,
            'inventory_receipt_layer_id' => $layer->id,
            'product_id' => $item->product_id,
            'warehouse_id' => $this->warehouse->id,
            'company_id' => $this->company->id,
            'quantity' => $qty,
            'unit_cost' => $cost,
            'total_cost' => round($qty * $cost, 4),
            'created_at' => $at ?? now()->toDateTimeString(),
        ]);

        return $layer;
    }

    private function service(): AbcClassificationService
    {
        return app(AbcClassificationService::class);
    }

    // ── 1. Products with no consumption default to Class C ────────────────────

    public function test_products_with_no_consumption_are_classified_as_c(): void
    {
        $product = $this->makeProduct();
        $this->seedItem($product, 10.0);

        $summary = $this->service()->recalculate();

        $this->assertEquals(1, $summary['total']);
        $this->assertEquals(0, $summary['A']);
        $this->assertEquals(0, $summary['B']);
        $this->assertEquals(1, $summary['C']);

        $abc = InventoryAbcClassification::query()->where('product_id', $product->id)->first();
        $this->assertNotNull($abc);
        $this->assertEquals(AbcClass::C, $abc->classification);
        $this->assertEquals(0.0, (float) $abc->annual_consumption_value);
    }

    // ── 2. Single consuming product is assigned a valid class ─────────────────

    public function test_single_consuming_product_gets_classified(): void
    {
        $product = $this->makeProduct();
        $item = $this->seedItem($product, 100.0);
        $this->addConsumption($item, 50.0, 40.0); // total_cost = 2000

        $this->service()->recalculate();

        $abc = InventoryAbcClassification::query()->where('product_id', $product->id)->first();
        $this->assertNotNull($abc);
        $this->assertEquals(2000.0, (float) $abc->annual_consumption_value);
        // Only 1 product with 100% of value → cumPct = 100 > 90 → Class C
        $this->assertEquals(AbcClass::C, $abc->classification);
    }

    // ── 3. Three products split correctly into A / B / C ─────────────────────

    public function test_three_products_split_into_abc_classes_by_pareto(): void
    {
        // Product values: 700, 200, 100 → total = 1000
        // Cumulative: 700/1000=70% → A, 900/1000=90% → B, 1000/1000=100% → C
        $pA = $this->makeProduct();
        $pB = $this->makeProduct();
        $pC = $this->makeProduct();

        $iA = $this->seedItem($pA, 100.0);
        $iB = $this->seedItem($pB, 100.0);
        $iC = $this->seedItem($pC, 100.0);

        $this->addConsumption($iA, 70.0, 10.0);  // value = 700
        $this->addConsumption($iB, 20.0, 10.0);  // value = 200
        $this->addConsumption($iC, 10.0, 10.0);  // value = 100

        $summary = $this->service()->recalculate();

        $this->assertEquals(3, $summary['total']);
        $this->assertEquals(1, $summary['A']);
        $this->assertEquals(1, $summary['B']);
        $this->assertEquals(1, $summary['C']);

        $this->assertEquals(AbcClass::A, InventoryAbcClassification::query()->where('product_id', $pA->id)->value('classification'));
        $this->assertEquals(AbcClass::B, InventoryAbcClassification::query()->where('product_id', $pB->id)->value('classification'));
        $this->assertEquals(AbcClass::C, InventoryAbcClassification::query()->where('product_id', $pC->id)->value('classification'));
    }

    // ── 4. Cumulative percentage is stored correctly ──────────────────────────

    public function test_cumulative_percentage_is_stored_correctly(): void
    {
        $pA = $this->makeProduct();
        $pB = $this->makeProduct();
        $iA = $this->seedItem($pA, 100.0);
        $iB = $this->seedItem($pB, 100.0);

        $this->addConsumption($iA, 80.0, 10.0); // value = 800
        $this->addConsumption($iB, 20.0, 10.0); // value = 200, total = 1000

        $this->service()->recalculate();

        $abcA = InventoryAbcClassification::query()->where('product_id', $pA->id)->first();
        $abcB = InventoryAbcClassification::query()->where('product_id', $pB->id)->first();

        $this->assertEquals(80.0, round((float) $abcA->cumulative_percentage, 2));
        $this->assertEquals(100.0, round((float) $abcB->cumulative_percentage, 2));
    }

    // ── 5. Cycle count plan created with correct frequency ───────────────────

    public function test_recalculate_creates_cycle_count_plans_with_correct_frequency(): void
    {
        $pA = $this->makeProduct();
        $pB = $this->makeProduct();
        $pC = $this->makeProduct();
        $iA = $this->seedItem($pA, 10.0);
        $iB = $this->seedItem($pB, 10.0);
        $iC = $this->seedItem($pC, 10.0);

        $this->addConsumption($iA, 70.0, 10.0);
        $this->addConsumption($iB, 20.0, 10.0);
        $this->addConsumption($iC, 10.0, 10.0);

        $this->service()->recalculate();

        $planA = CycleCountPlan::query()->where('product_id', $pA->id)->first();
        $planB = CycleCountPlan::query()->where('product_id', $pB->id)->first();
        $planC = CycleCountPlan::query()->where('product_id', $pC->id)->first();

        $this->assertNotNull($planA);
        $this->assertEquals(AbcClass::A, $planA->abc_class);
        $this->assertEquals(30, $planA->frequency_days);

        $this->assertNotNull($planB);
        $this->assertEquals(AbcClass::B, $planB->abc_class);
        $this->assertEquals(90, $planB->frequency_days);

        $this->assertNotNull($planC);
        $this->assertEquals(AbcClass::C, $planC->abc_class);
        $this->assertEquals(180, $planC->frequency_days);
    }

    // ── 6. Product never counted → is_overdue = true ─────────────────────────

    public function test_product_never_counted_has_overdue_cycle_plan(): void
    {
        $product = $this->makeProduct();
        $item = $this->seedItem($product, 10.0);
        $this->addConsumption($item, 70.0, 10.0);

        $this->service()->recalculate();

        $plan = CycleCountPlan::query()->where('product_id', $product->id)->first();
        $this->assertNotNull($plan);
        $this->assertNull($plan->last_counted_at);
        $this->assertNull($plan->next_due_at);
        $this->assertTrue($plan->is_overdue);
    }

    // ── 7. Recently counted product → not overdue ────────────────────────────

    public function test_recently_counted_product_is_not_overdue(): void
    {
        $product = $this->makeProduct();
        $item = $this->seedItem($product, 10.0);
        $this->addConsumption($item, 70.0, 10.0);

        // Create and approve a count session today
        $session = app(CreateCountSessionAction::class)->execute([
            'company_id' => $this->company->id,
            'warehouse_id' => $this->warehouse->id,
            'notes' => 'recent count',
        ]);
        app(StartCountSessionAction::class)->execute($session);
        InventoryCountLine::query()
            ->where('session_id', $session->id)
            ->where('product_id', $product->id)
            ->update(['counted_qty' => 10.0]);
        app(CompleteCountSessionAction::class)->execute($session->refresh());
        app(ApproveCountSessionAction::class)->execute($session->refresh());

        // Stamp completed_at as today
        InventoryCountSession::query()
            ->where('id', $session->id)
            ->update(['completed_at' => now()->toDateTimeString()]);

        $this->service()->recalculate();

        $plan = CycleCountPlan::query()->where('product_id', $product->id)->first();
        $this->assertNotNull($plan);
        $this->assertNotNull($plan->last_counted_at);
        $this->assertNotNull($plan->next_due_at);
        $this->assertFalse($plan->is_overdue);
    }

    // ── 8. Recalculate is idempotent (no duplicates) ─────────────────────────

    public function test_recalculate_is_idempotent(): void
    {
        $product = $this->makeProduct();
        $item = $this->seedItem($product, 10.0);
        $this->addConsumption($item, 50.0, 10.0);

        $this->service()->recalculate();
        $this->service()->recalculate();

        $this->assertEquals(1, InventoryAbcClassification::query()->where('product_id', $product->id)->count());
        $this->assertEquals(1, CycleCountPlan::query()->where('product_id', $product->id)->count());
    }

    // ── 9. Consumptions older than 12 months are excluded ────────────────────

    public function test_consumptions_older_than_12_months_are_excluded(): void
    {
        $product = $this->makeProduct();
        $item = $this->seedItem($product, 10.0);

        // Consumption outside the rolling 12-month window
        $this->addConsumption($item, 100.0, 50.0, Carbon::now()->subMonths(13)->toDateTimeString());

        $this->service()->recalculate();

        $abc = InventoryAbcClassification::query()->where('product_id', $product->id)->first();
        $this->assertEquals(0.0, (float) $abc->annual_consumption_value);
        $this->assertEquals(AbcClass::C, $abc->classification);
    }

    // ── 10. AbcClass enum helpers return correct values ──────────────────────

    public function test_abc_class_frequency_and_label_helpers(): void
    {
        $this->assertEquals(30, AbcClass::A->frequencyDays());
        $this->assertEquals(90, AbcClass::B->frequencyDays());
        $this->assertEquals(180, AbcClass::C->frequencyDays());

        $this->assertEquals('Monthly', AbcClass::A->frequencyLabel());
        $this->assertEquals('Quarterly', AbcClass::B->frequencyLabel());
        $this->assertEquals('Semi-Annual', AbcClass::C->frequencyLabel());
    }
}
