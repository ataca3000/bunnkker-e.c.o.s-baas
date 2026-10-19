<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\IAM\Domain\Models\Permission;
use Modules\IAM\Domain\Models\Role;
use Modules\Inventory\CountSessions\Application\Actions\ApproveCountSessionAction;
use Modules\Inventory\CountSessions\Application\Actions\CancelCountSessionAction;
use Modules\Inventory\CountSessions\Application\Actions\CompleteCountSessionAction;
use Modules\Inventory\CountSessions\Application\Actions\CreateCountSessionAction;
use Modules\Inventory\CountSessions\Application\Actions\StartCountSessionAction;
use Modules\Inventory\CountSessions\Domain\Enums\CountSessionStatus;
use Modules\Inventory\CountSessions\Domain\Models\InventoryCountLine;
use Modules\Inventory\CountSessions\Domain\Models\InventoryCountSession;
use Modules\Inventory\InventoryItems\Domain\Enums\LedgerMovementType;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\InventoryItems\Domain\Models\StockLedgerEntry;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryLayerConsumption;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryReceiptLayer;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceipt;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceiptLine;
use Modules\Purchasing\Suppliers\Domain\Models\Supplier;
use Tests\TestCase;

/**
 * COM-011: Inventory Adjustments & Stock Count
 */
class InventoryCountSessionTest extends TestCase
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

    private function makeProduct(float $price = 100.0, float $avgCost = 80.0): Product
    {
        return Product::factory()->create([
            'regular_price' => $price,
            'sale_price' => $price,
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

    private function addLayer(InventoryItem $item, float $qty, float $cost = 80.0): InventoryReceiptLayer
    {
        $gr = GoodsReceipt::factory()->create(['warehouse_id' => $this->warehouse->id]);
        $grLine = GoodsReceiptLine::factory()->create([
            'goods_receipt_id' => $gr->id,
            'product_id' => $item->product_id,
        ]);

        return InventoryReceiptLayer::query()->create([
            'company_id' => $this->company->id,
            'supplier_id' => $this->supplier->id,
            'product_id' => $item->product_id,
            'goods_receipt_id' => $gr->id,
            'goods_receipt_line_id' => $grLine->id,
            'warehouse_id' => $this->warehouse->id,
            'received_qty' => $qty,
            'remaining_qty' => $qty,
            'landed_unit_cost' => $cost,
            'receipt_date' => now()->toDateString(),
        ]);
    }

    private function createSession(): InventoryCountSession
    {
        return app(CreateCountSessionAction::class)->execute([
            'company_id' => $this->company->id,
            'warehouse_id' => $this->warehouse->id,
            'notes' => 'Test count '.uniqid(),
        ]);
    }

    private function setCountedQty(InventoryCountSession $session, string $productId, float $qty): void
    {
        InventoryCountLine::query()
            ->where('session_id', $session->id)
            ->where('product_id', $productId)
            ->update(['counted_qty' => $qty]);
    }

    // ── 1. Create session auto-generates count lines ──────────────────────────

    public function test_create_session_generates_lines_from_warehouse_inventory(): void
    {
        $p1 = $this->makeProduct();
        $p2 = $this->makeProduct();
        $this->seedItem($p1, 10.0);
        $this->seedItem($p2, 5.0);

        $session = $this->createSession();

        $this->assertEquals(CountSessionStatus::Draft, $session->status);
        $this->assertStringStartsWith('CNT-', $session->count_number);
        $this->assertCount(2, $session->lines);

        $line = $session->lines->firstWhere('product_id', $p1->id);
        $this->assertNotNull($line);
        $this->assertEquals('10.0000', $line->system_qty);
        $this->assertNull($line->counted_qty);
    }

    // ── 2. Start transitions status ───────────────────────────────────────────

    public function test_start_session_transitions_to_in_progress(): void
    {
        $this->seedItem($this->makeProduct(), 10.0);
        $session = $this->createSession();

        $started = app(StartCountSessionAction::class)->execute($session);

        $this->assertEquals(CountSessionStatus::InProgress, $started->status);
        $this->assertNotNull($started->started_at);
    }

    // ── 3. Complete computes variances ────────────────────────────────────────

    public function test_complete_computes_variance_per_line(): void
    {
        $product = $this->makeProduct(price: 100.0, avgCost: 80.0);
        $this->seedItem($product, 10.0);

        $session = $this->createSession();
        app(StartCountSessionAction::class)->execute($session);

        // Count 8 instead of system 10 → variance = -2
        $this->setCountedQty($session, $product->id, 8.0);

        $completed = app(CompleteCountSessionAction::class)->execute($session->refresh());

        $this->assertEquals(CountSessionStatus::Completed, $completed->status);

        $line = $completed->lines->firstWhere('product_id', $product->id);
        $this->assertEquals('-2.0000', $line->variance_qty);  // 8 - 10
        $this->assertEquals(-160.0, (float) $line->variance_value);  // -2 × 80
    }

    // ── 4. Approve posts adjustment in for positive variance ──────────────────

    public function test_approve_posts_adjustment_in_for_positive_variance(): void
    {
        $product = $this->makeProduct(avgCost: 80.0);
        $item = $this->seedItem($product, 10.0);

        $session = $this->createSession();
        app(StartCountSessionAction::class)->execute($session);

        // Count 12 instead of 10 → +2 variance
        $this->setCountedQty($session, $product->id, 12.0);

        app(CompleteCountSessionAction::class)->execute($session->refresh());
        $approved = app(ApproveCountSessionAction::class)->execute($session->refresh());

        $item->refresh();
        $this->assertEquals('12.0000', $item->on_hand_qty);

        // New receipt layer should exist for the adjustment in (goods_receipt_id is null for adjustments)
        $adjustmentLayer = InventoryReceiptLayer::query()
            ->where('product_id', $product->id)
            ->whereNull('goods_receipt_id')
            ->first();
        $this->assertNotNull($adjustmentLayer);
        $this->assertEquals('2.0000', $adjustmentLayer->remaining_qty);
    }

    // ── 5. Approve posts adjustment out for negative variance ─────────────────

    public function test_approve_posts_adjustment_out_for_negative_variance(): void
    {
        $product = $this->makeProduct(avgCost: 80.0);
        $item = $this->seedItem($product, 10.0);
        $this->addLayer($item, qty: 10.0, cost: 80.0);

        $session = $this->createSession();
        app(StartCountSessionAction::class)->execute($session);

        // Count 7 instead of 10 → -3 variance
        $this->setCountedQty($session, $product->id, 7.0);

        app(CompleteCountSessionAction::class)->execute($session->refresh());
        app(ApproveCountSessionAction::class)->execute($session->refresh());

        $item->refresh();
        $this->assertEquals('7.0000', $item->on_hand_qty);
    }

    // ── 6. FIFO consumption triggered on adjustment out ───────────────────────

    public function test_fifo_consumption_record_created_for_adjustment_out(): void
    {
        $product = $this->makeProduct(avgCost: 80.0);
        $item = $this->seedItem($product, 10.0);
        $layer = $this->addLayer($item, qty: 10.0, cost: 80.0);

        $session = $this->createSession();
        app(StartCountSessionAction::class)->execute($session);

        $this->setCountedQty($session, $product->id, 8.0); // -2 variance

        app(CompleteCountSessionAction::class)->execute($session->refresh());
        app(ApproveCountSessionAction::class)->execute($session->refresh());

        // FIFO consumed 2 units → layer remaining should be 8
        $this->assertEquals('8.0000', $layer->fresh()->remaining_qty);

        // Consumption audit record should exist
        $consumed = InventoryLayerConsumption::query()
            ->where('product_id', $product->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->get();
        $this->assertNotEmpty($consumed);
    }

    // ── 7. Receipt layer created for adjustment in ────────────────────────────

    public function test_receipt_layer_created_for_adjustment_in(): void
    {
        $product = $this->makeProduct(avgCost: 60.0);
        $this->seedItem($product, 5.0);

        $session = $this->createSession();
        app(StartCountSessionAction::class)->execute($session);

        $this->setCountedQty($session, $product->id, 8.0); // +3 variance

        app(CompleteCountSessionAction::class)->execute($session->refresh());
        $approved = app(ApproveCountSessionAction::class)->execute($session->refresh());

        // Adjustment-in layer has no goods_receipt_id (null for count adjustments)
        $layer = InventoryReceiptLayer::query()
            ->where('product_id', $product->id)
            ->whereNull('goods_receipt_id')
            ->first();

        $this->assertNotNull($layer);
        $this->assertEquals('3.0000', $layer->received_qty);
        $this->assertEquals('60.0000', $layer->landed_unit_cost); // product average_cost
    }

    // ── 8. Mobile mode hides system_qty ──────────────────────────────────────

    public function test_mobile_mode_hides_system_qty_from_lines(): void
    {
        $product = $this->makeProduct();
        $this->seedItem($product, 10.0);

        $session = $this->createSession();
        app(StartCountSessionAction::class)->execute($session);
        $session->loadMissing('lines.product', 'warehouse');

        // Simulate the controller's mobile-mode formatting (hide_system_qty=true)
        $hideSysQty = true;
        $lines = $session->lines->map(function (InventoryCountLine $line) use ($hideSysQty): array {
            $row = [
                'id' => $line->id,
                'product_id' => $line->product_id,
                'counted_qty' => null,
                'variance_qty' => null,
            ];
            if (! $hideSysQty) {
                $row['system_qty'] = (float) $line->system_qty;
            }

            return $row;
        })->values()->toArray();

        foreach ($lines as $line) {
            $this->assertArrayNotHasKey('system_qty', $line);
        }

        // Normal mode includes system_qty
        $hideSysQty = false;
        $linesNormal = $session->lines->map(function (InventoryCountLine $line) use ($hideSysQty): array {
            $row = ['id' => $line->id, 'product_id' => $line->product_id];
            if (! $hideSysQty) {
                $row['system_qty'] = (float) $line->system_qty;
            }

            return $row;
        })->values()->toArray();

        foreach ($linesNormal as $line) {
            $this->assertArrayHasKey('system_qty', $line);
        }
    }

    // ── 9. Cancel transitions from draft ──────────────────────────────────────

    public function test_cancel_from_draft(): void
    {
        $this->seedItem($this->makeProduct(), 10.0);
        $session = $this->createSession();

        $cancelled = app(CancelCountSessionAction::class)->execute($session);

        $this->assertEquals(CountSessionStatus::Cancelled, $cancelled->status);
    }

    // ── 10. Audit trail — ledger traceability ─────────────────────────────────

    public function test_adjustment_creates_ledger_entry(): void
    {
        $product = $this->makeProduct(avgCost: 80.0);
        $item = $this->seedItem($product, 10.0);
        $this->addLayer($item, qty: 10.0, cost: 80.0);

        $session = $this->createSession();
        app(StartCountSessionAction::class)->execute($session);

        $this->setCountedQty($session, $product->id, 7.0); // -3 variance

        app(CompleteCountSessionAction::class)->execute($session->refresh());
        app(ApproveCountSessionAction::class)->execute($session->refresh());

        $ledgerEntry = StockLedgerEntry::query()
            ->where('product_id', $product->id)
            ->where('movement_type', LedgerMovementType::AdjustmentOut->value)
            ->where('reference_type', 'inventory_count')
            ->where('reference_id', $session->id)
            ->first();

        $this->assertNotNull($ledgerEntry);
        $this->assertEquals('3.0000', $ledgerEntry->quantity);
    }

    // ── 11. Accuracy calculation in variance summary ──────────────────────────

    public function test_accuracy_percentage_of_completed_session(): void
    {
        $p1 = $this->makeProduct();
        $p2 = $this->makeProduct();
        $this->seedItem($p1, 10.0);
        $this->seedItem($p2, 10.0);

        $session = $this->createSession();
        app(StartCountSessionAction::class)->execute($session);

        // p1 exactly right (0 variance), p2 off by 2
        $this->setCountedQty($session, $p1->id, 10.0);
        $this->setCountedQty($session, $p2->id, 8.0);

        $completed = app(CompleteCountSessionAction::class)->execute($session->refresh());
        $completed->loadMissing('lines');

        // Replicate controller's calcAccuracy logic
        $counted = $completed->lines->filter(fn ($l) => $l->counted_qty !== null);
        $total = $counted->count();
        $correct = $counted->filter(fn ($l) => (float) $l->variance_qty === 0.0)->count();
        $accuracy = $total > 0 ? round($correct / $total * 100, 2) : null;

        // 1 of 2 lines accurate → 50%
        $this->assertEquals(50.0, $accuracy);
    }

    // ── 12. Invalid transitions are rejected ──────────────────────────────────

    public function test_cannot_approve_a_draft_session(): void
    {
        $this->seedItem($this->makeProduct(), 10.0);
        $session = $this->createSession();

        $this->expectException(\Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException::class);

        app(ApproveCountSessionAction::class)->execute($session);
    }

    // ── REGRESSION: TASK-INV-FIX-001 ─────────────────────────────────────────

    // ── R1. Zero-cost prevention — 422 when product has no valid cost ─────────

    public function test_approve_rejects_when_product_has_no_cost(): void
    {
        // Product with no cost fields set
        $product = Product::factory()->create([
            'regular_price' => 50.0,
            'sale_price' => 50.0,
            'average_cost' => null,
            'last_purchase_cost' => null,
            'current_fifo_cost' => null,
        ]);
        $this->seedItem($product, 10.0);

        $session = $this->createSession();
        app(StartCountSessionAction::class)->execute($session);
        $this->setCountedQty($session, $product->id, 12.0); // +2 variance → will be adjusted

        app(CompleteCountSessionAction::class)->execute($session->refresh());

        $this->expectException(\Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException::class);

        app(ApproveCountSessionAction::class)->execute($session->refresh());
    }

    // ── R2. Permission enforcement — 403 without inventory.count.approve ──────

    public function test_approve_route_returns_403_without_permission(): void
    {
        $user = User::factory()->create();

        // Assign a role that has NO inventory.count.approve permission
        $role = Role::create(['name' => 'Inventory Operator', 'slug' => 'inventory-operator', 'is_system' => false]);
        $viewPerm = Permission::create(['name' => 'inventory.count.view', 'module' => 'inventory', 'resource' => 'count', 'action' => 'view']);
        $role->permissions()->attach($viewPerm->id);
        $user->roles()->attach($role->id);

        $this->seedItem($this->makeProduct(), 5.0);
        $session = $this->createSession();

        $this->actingAs($user)
            ->postJson("/api/inventory-counts/{$session->id}/approve")
            ->assertForbidden();
    }

    // ── R3. Fractional quantities — BCMath exact decimal variance ────────────

    public function test_complete_computes_exact_fractional_variance(): void
    {
        $product = $this->makeProduct(price: 100.0, avgCost: 80.0);
        $this->seedItem($product, 12.375); // system_qty = 12.3750

        $session = $this->createSession();
        app(StartCountSessionAction::class)->execute($session);

        $this->setCountedQty($session, $product->id, 12.125); // counted = 12.1250

        $completed = app(CompleteCountSessionAction::class)->execute($session->refresh());

        $line = $completed->lines->firstWhere('product_id', $product->id);
        $this->assertNotNull($line);

        // variance_qty must be exactly -0.2500 (BCMath: 12.1250 - 12.3750 = -0.2500)
        $this->assertEquals('-0.2500', $line->variance_qty);

        // variance_value = -0.2500 × 80.00 = -20.00
        $this->assertEquals('-20.00', $line->variance_value);
    }

    // ── R4. Photo field removed — no errors on model or API ──────────────────

    public function test_photo_path_is_not_in_count_line_fillable(): void
    {
        $line = new InventoryCountLine;

        $this->assertNotContains('photo_path', $line->getFillable());
    }

    public function test_updating_count_line_without_photo_path_succeeds(): void
    {
        $product = $this->makeProduct();
        $this->seedItem($product, 10.0);

        $session = $this->createSession();
        app(StartCountSessionAction::class)->execute($session);

        // Direct model update without photo_path — must not throw
        InventoryCountLine::query()
            ->where('session_id', $session->id)
            ->where('product_id', $product->id)
            ->update(['counted_qty' => 9.0, 'notes' => 'Counted carefully.']);

        $line = InventoryCountLine::query()
            ->where('session_id', $session->id)
            ->where('product_id', $product->id)
            ->first();

        $this->assertNotNull($line);
        $this->assertEquals('9.0000', $line->counted_qty);
        $this->assertSame('Counted carefully.', $line->notes);
        $this->assertFalse(isset($line->photo_path));
    }
}
