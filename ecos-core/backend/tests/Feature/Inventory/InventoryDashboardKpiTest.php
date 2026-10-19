<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Inventory\CountSessions\Application\Actions\ApproveCountSessionAction;
use Modules\Inventory\CountSessions\Application\Actions\CompleteCountSessionAction;
use Modules\Inventory\CountSessions\Application\Actions\CreateCountSessionAction;
use Modules\Inventory\CountSessions\Application\Actions\StartCountSessionAction;
use Modules\Inventory\CountSessions\Domain\Models\InventoryCountLine;
use Modules\Inventory\CountSessions\Domain\Models\InventoryCountSession;
use Modules\Inventory\InventoryControl\Application\Services\InventoryDashboardService;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryReceiptLayer;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * COM-011A: Inventory Control Dashboard KPIs
 */
class InventoryDashboardKpiTest extends TestCase
{
    use RefreshDatabase;

    private Company $company;

    private Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();
        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeProduct(float $avgCost = 80.0): Product
    {
        return Product::factory()->create([
            'regular_price' => 100.0,
            'average_cost' => $avgCost,
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
     * Add a receipt layer with available remaining_qty so FIFO can consume it.
     * Uses nullable GR columns (no factory side-products).
     */
    private function addLayer(InventoryItem $item, float $qty, float $cost = 80.0): InventoryReceiptLayer
    {
        return InventoryReceiptLayer::query()->create([
            'company_id' => $this->company->id,
            'product_id' => $item->product_id,
            'warehouse_id' => $this->warehouse->id,
            'received_qty' => $qty,
            'remaining_qty' => $qty,
            'landed_unit_cost' => $cost,
            'receipt_date' => now()->toDateString(),
        ]);
    }

    /**
     * Full lifecycle: create → start → set counted_qty → complete → approve.
     * Returns the approved session.
     */
    private function createApprovedSession(array $productQuantities = []): InventoryCountSession
    {
        $session = app(CreateCountSessionAction::class)->execute([
            'company_id' => $this->company->id,
            'warehouse_id' => $this->warehouse->id,
            'notes' => 'test',
        ]);

        app(StartCountSessionAction::class)->execute($session);

        foreach ($productQuantities as $productId => $countedQty) {
            InventoryCountLine::query()
                ->where('session_id', $session->id)
                ->where('product_id', $productId)
                ->update(['counted_qty' => $countedQty]);
        }

        app(CompleteCountSessionAction::class)->execute($session->refresh());
        app(ApproveCountSessionAction::class)->execute($session->refresh());

        return $session->refresh();
    }

    private function service(): InventoryDashboardService
    {
        return app(InventoryDashboardService::class);
    }

    // ── 1. No data → accuracy_pct is null ────────────────────────────────────

    public function test_kpis_return_null_accuracy_when_no_sessions(): void
    {
        $kpis = $this->service()->kpis();

        $this->assertNull($kpis['accuracy_pct']);
        $this->assertEquals(0, $kpis['open_sessions']);
        $this->assertEquals(0, $kpis['products_with_variance']);
        $this->assertEquals(0.0, $kpis['adjustment_value_month']);
        $this->assertEquals(0.0, $kpis['shrinkage_value_month']);
        $this->assertNull($kpis['last_count_date']);
        $this->assertEquals('unknown', $kpis['health']);
    }

    // ── 2. Perfect count → accuracy_pct = 100 ────────────────────────────────

    public function test_accuracy_pct_is_100_when_all_counts_match(): void
    {
        $p = $this->makeProduct(avgCost: 80.0);
        $this->seedItem($p, 10.0);

        // No variance — no layers needed
        $this->createApprovedSession([$p->id => 10.0]);

        $kpis = $this->service()->kpis();

        $this->assertEquals(100.0, $kpis['accuracy_pct']);
        $this->assertEquals('excellent', $kpis['health']);
        $this->assertEquals(1, $kpis['matched_products']);
        $this->assertEquals(1, $kpis['total_counted_products']);
    }

    // ── 3. Mixed counts → accuracy_pct is partial ────────────────────────────

    public function test_accuracy_pct_reflects_partial_matches(): void
    {
        $p1 = $this->makeProduct();
        $p2 = $this->makeProduct();
        $i1 = $this->seedItem($p1, 10.0);
        $i2 = $this->seedItem($p2, 10.0);

        // p2 has negative variance (-2) → needs a receipt layer for FIFO
        $this->addLayer($i2, 10.0);

        // p1: matches (10=10), p2: variance (8≠10)
        $this->createApprovedSession([$p1->id => 10.0, $p2->id => 8.0]);

        $kpis = $this->service()->kpis();

        $this->assertEquals(50.0, $kpis['accuracy_pct']); // 1 of 2 matched
        $this->assertEquals(1, $kpis['matched_products']);
        $this->assertEquals(2, $kpis['total_counted_products']);
    }

    // ── 4. Open sessions count ────────────────────────────────────────────────

    public function test_open_sessions_counts_draft_and_in_progress(): void
    {
        $product = $this->makeProduct();
        $this->seedItem($product, 10.0);

        // Draft session
        app(CreateCountSessionAction::class)->execute([
            'company_id' => $this->company->id,
            'warehouse_id' => $this->warehouse->id,
            'notes' => 'draft',
        ]);

        // In-progress session
        $inProgress = app(CreateCountSessionAction::class)->execute([
            'company_id' => $this->company->id,
            'warehouse_id' => $this->warehouse->id,
            'notes' => 'in-progress',
        ]);
        app(StartCountSessionAction::class)->execute($inProgress);

        $kpis = $this->service()->kpis();
        $this->assertEquals(2, $kpis['open_sessions']);
    }

    // ── 5. Products with variance (last 30 days) ──────────────────────────────

    public function test_products_with_variance_counts_non_zero_variance_lines(): void
    {
        $p1 = $this->makeProduct();
        $p2 = $this->makeProduct();
        $p3 = $this->makeProduct();
        $i1 = $this->seedItem($p1, 10.0);
        $i2 = $this->seedItem($p2, 10.0);
        $i3 = $this->seedItem($p3, 10.0);

        // p2 negative variance → needs layer; p3 positive variance → no layer
        $this->addLayer($i2, 10.0);

        // p1: exact match, p2: shortage, p3: surplus
        $this->createApprovedSession([
            $p1->id => 10.0,
            $p2->id => 8.0,
            $p3->id => 12.0,
        ]);

        $kpis = $this->service()->kpis();
        $this->assertEquals(2, $kpis['products_with_variance']);
    }

    // ── 6. Adjustment value and shrinkage this month ──────────────────────────

    public function test_adjustment_value_and_shrinkage_are_calculated_correctly(): void
    {
        // avgCost = 80 → variance_value = variance_qty * 80
        // p1 system=10 count=12 → variance=+2 → adj_in  = +160
        // p2 system=10 count=8  → variance=-2 → shrinkage = 160
        $p1 = $this->makeProduct(avgCost: 80.0);
        $p2 = $this->makeProduct(avgCost: 80.0);
        $i1 = $this->seedItem($p1, 10.0);
        $i2 = $this->seedItem($p2, 10.0);

        // p2 negative variance (-2) → needs a layer
        $this->addLayer($i2, 10.0, 80.0);

        $this->createApprovedSession([$p1->id => 12.0, $p2->id => 8.0]);

        $kpis = $this->service()->kpis();

        $this->assertEquals(160.0, $kpis['adjustment_value_month']);
        $this->assertEquals(160.0, $kpis['shrinkage_value_month']);
    }

    // ── 7. Last count date is set correctly ──────────────────────────────────

    public function test_last_count_date_reflects_most_recent_approved_session(): void
    {
        $p = $this->makeProduct();
        $this->seedItem($p, 10.0);

        // Perfect match — no layers needed
        $this->createApprovedSession([$p->id => 10.0]);

        $kpis = $this->service()->kpis();
        $this->assertNotNull($kpis['last_count_date']);
    }

    // ── 8. Health label reflects accuracy thresholds ─────────────────────────

    public function test_health_label_reflects_accuracy_thresholds(): void
    {
        // 4 products: 2 exact, 2 short → accuracy = 50% → critical
        $products = [];
        $items = [];
        for ($i = 0; $i < 4; $i++) {
            $p = $this->makeProduct();
            $items[] = $this->seedItem($p, 10.0);
            $products[] = $p;
        }

        // products[2] and [3] have negative variance (-5) → need layers
        $this->addLayer($items[2], 10.0);
        $this->addLayer($items[3], 10.0);

        $counted = [
            $products[0]->id => 10.0,
            $products[1]->id => 10.0,
            $products[2]->id => 5.0,
            $products[3]->id => 5.0,
        ];
        $this->createApprovedSession($counted);

        $kpis = $this->service()->kpis();
        $this->assertEquals(50.0, $kpis['accuracy_pct']);
        $this->assertEquals('critical', $kpis['health']);
    }

    // ── 9. Top negative variances ─────────────────────────────────────────────

    public function test_top_negative_variances_returns_most_negative_products(): void
    {
        $p1 = $this->makeProduct(avgCost: 100.0);
        $p2 = $this->makeProduct(avgCost: 100.0);
        $i1 = $this->seedItem($p1, 20.0);
        $i2 = $this->seedItem($p2, 10.0);

        // Both have negative variance → need layers
        $this->addLayer($i1, 20.0, 100.0); // p1: count=10 → variance=-10
        $this->addLayer($i2, 10.0, 100.0); // p2: count=8  → variance=-2

        $this->createApprovedSession([$p1->id => 10.0, $p2->id => 8.0]);

        $topNeg = $this->service()->topNegativeVariances(5);

        $this->assertCount(2, $topNeg);
        // p1 has more negative variance (-10 vs -2)
        $this->assertEquals($p1->id, $topNeg[0]['product_id']);
        $this->assertEquals(-10.0, (float) $topNeg[0]['variance_qty']);
    }

    // ── 10. Recent sessions are returned ─────────────────────────────────────

    public function test_recent_sessions_returns_latest_sessions_with_accuracy(): void
    {
        $p = $this->makeProduct();
        $this->seedItem($p, 10.0);

        $this->createApprovedSession([$p->id => 10.0]); // perfect match — no layers

        $recent = $this->service()->recentSessions(5);

        $this->assertCount(1, $recent);
        $this->assertArrayHasKey('id', $recent[0]);
        $this->assertArrayHasKey('count_number', $recent[0]);
        $this->assertArrayHasKey('accuracy_pct', $recent[0]);
        $this->assertEquals(100.0, $recent[0]['accuracy_pct']);
    }
}
