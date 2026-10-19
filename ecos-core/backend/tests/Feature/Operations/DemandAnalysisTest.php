<?php

declare(strict_types=1);

namespace Tests\Feature\Operations;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Orders\Domain\Models\OrderLine;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Operations\DemandAnalysis\Application\Services\DemandAnalysisService;
use Modules\Operations\DemandAnalysis\Domain\Enums\InventoryStatus;
use Modules\Operations\DemandAnalysis\Events\DemandAnalysisCompleted;
use Modules\Operations\DemandAnalysis\Events\DemandAnalysisStarted;
use Modules\Organization\Brands\Domain\Models\Brand;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\Sales\Customers\Domain\Models\Customer;
use Tests\TestCase;

/**
 * OP-001: Demand Analysis Engine
 */
class DemandAnalysisTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Company $company;

    private Brand $brand;

    private Warehouse $warehouse;

    private Channel $channel;

    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->brand = Brand::factory()->create(['company_id' => $this->company->id]);
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);
        $this->channel = Channel::factory()->create([
            'brand_id' => $this->brand->id,
        ]);
        $this->customer = Customer::factory()->create();
        $this->user = User::factory()->create();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeProduct(?string $sku = null): Product
    {
        return Product::factory()->create([
            'sku' => $sku ?? 'SKU-'.uniqid(),
        ]);
    }

    private function seedStock(Product $product, float $onHand, float $reserved = 0.0): InventoryItem
    {
        return InventoryItem::query()->create([
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $product->id,
            'company_id' => $this->company->id,
            'on_hand_qty' => $onHand,
            'reserved_qty' => $reserved,
        ]);
    }

    private function makeOrder(
        OrderStatus $status = OrderStatus::NewOrder,
        ?Channel $channel = null,
    ): Order {
        return Order::query()->create([
            'channel_id' => ($channel ?? $this->channel)->id,
            'customer_id' => $this->customer->id,
            'order_number' => 'ORD-'.uniqid(),
            'order_date' => now()->toDateString(),
            'status' => $status->value,
            'subtotal' => 0,
            'total' => 0,
            'shipping_total' => 0,
            'discount_total' => 0,
            'tax_total' => 0,
        ]);
    }

    private function addLine(Order $order, Product $product, float $qty): OrderLine
    {
        return OrderLine::query()->create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'quantity' => $qty,
            'unit_price' => 10.00,
            'line_total' => $qty * 10.00,
        ]);
    }

    private function service(): DemandAnalysisService
    {
        return app(DemandAnalysisService::class);
    }

    // ── 1. Empty database returns zero results ────────────────────────────────

    public function test_empty_database_returns_zero_demand_lines(): void
    {
        $result = $this->service()->analyze();

        $this->assertSame(0, $result->totalOrders);
        $this->assertSame(0, $result->totalProducts);
        $this->assertEmpty($result->demandLines);
    }

    // ── 2. API endpoint returns 200 with correct structure ────────────────────

    public function test_api_endpoint_returns_demand_matrix(): void
    {
        $product = $this->makeProduct('HON-1KG');
        $this->seedStock($product, 380.0, 380.0);
        $order = $this->makeOrder(OrderStatus::NewOrder);
        $this->addLine($order, $product, 420.0);

        $this->actingAs($this->user)
            ->getJson('/api/operations/demand-analysis')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'operational_day',
                    'generated_at',
                    'summary' => [
                        'total_orders',
                        'total_products',
                        'total_skus',
                        'ready_count',
                        'shortage_count',
                        'out_of_stock_count',
                        'unknown_count',
                    ],
                    'demand_lines' => [
                        '*' => [
                            'product_id',
                            'sku',
                            'product_name',
                            'ordered_qty',
                            'reserved_qty',
                            'available_qty',
                            'required_qty',
                            'shortage_qty',
                            'affected_orders_count',
                            'affected_channels_count',
                            'warehouse_count',
                            'inventory_status',
                        ],
                    ],
                ],
            ]);
    }

    // ── 3. READY — enough stock to cover demand ───────────────────────────────

    public function test_ready_status_when_stock_covers_demand(): void
    {
        $product = $this->makeProduct('DATE-MIX');
        $this->seedStock($product, 200.0); // plenty of stock
        $order = $this->makeOrder(OrderStatus::InProgress);
        $this->addLine($order, $product, 50.0);

        $result = $this->service()->analyze();

        $this->assertCount(1, $result->demandLines);
        $line = $result->demandLines[0];

        $this->assertSame(InventoryStatus::Ready, $line->inventoryStatus);
        $this->assertEqualsWithDelta(50.0, $line->orderedQty, 0.001);
        $this->assertEqualsWithDelta(200.0, $line->availableQty, 0.001);
        $this->assertEqualsWithDelta(0.0, $line->shortageQty(), 0.001);
    }

    // ── 4. SHORTAGE — partial stock ───────────────────────────────────────────

    public function test_shortage_status_when_stock_partially_covers_demand(): void
    {
        $product = $this->makeProduct('HON-1KG');
        $this->seedStock($product, 380.0, 380.0);
        $order = $this->makeOrder(OrderStatus::NewOrder);
        $this->addLine($order, $product, 420.0);

        $result = $this->service()->analyze();

        $this->assertCount(1, $result->demandLines);
        $line = $result->demandLines[0];

        $this->assertSame(InventoryStatus::Shortage, $line->inventoryStatus);
        $this->assertEqualsWithDelta(420.0, $line->orderedQty, 0.001);
        $this->assertEqualsWithDelta(380.0, $line->availableQty, 0.001);
        $this->assertEqualsWithDelta(40.0, $line->shortageQty(), 0.001);
    }

    // ── 5. OUT_OF_STOCK — zero on-hand stock ─────────────────────────────────

    public function test_out_of_stock_status_when_no_inventory_on_hand(): void
    {
        $product = $this->makeProduct('GIFT-BOX');
        $this->seedStock($product, 0.0, 0.0); // inventory exists, but empty
        $order = $this->makeOrder(OrderStatus::NewOrder);
        $this->addLine($order, $product, 80.0);

        $result = $this->service()->analyze();

        $this->assertCount(1, $result->demandLines);
        $line = $result->demandLines[0];

        $this->assertSame(InventoryStatus::OutOfStock, $line->inventoryStatus);
        $this->assertEqualsWithDelta(80.0, $line->shortageQty(), 0.001);
    }

    // ── 6. UNKNOWN — no inventory record at all ───────────────────────────────

    public function test_unknown_status_when_no_inventory_record_exists(): void
    {
        $product = $this->makeProduct('NEW-PROD');
        // deliberately NO seedStock call
        $order = $this->makeOrder(OrderStatus::NewOrder);
        $this->addLine($order, $product, 10.0);

        $result = $this->service()->analyze();

        $this->assertCount(1, $result->demandLines);
        $line = $result->demandLines[0];

        $this->assertSame(InventoryStatus::Unknown, $line->inventoryStatus);
        $this->assertNull($line->availableQty);
    }

    // ── 7. Cancelled and completed orders are excluded ────────────────────────

    public function test_cancelled_and_completed_orders_are_excluded(): void
    {
        $product = $this->makeProduct('OIL-1L');
        $cancelled = $this->makeOrder(OrderStatus::Cancelled);
        $completed = $this->makeOrder(OrderStatus::Delivered);
        $this->addLine($cancelled, $product, 5.0);
        $this->addLine($completed, $product, 10.0);

        $result = $this->service()->analyze();

        $this->assertEmpty($result->demandLines);
        $this->assertSame(0, $result->totalOrders);
    }

    // ── 8. Pending AND processing are both included ───────────────────────────

    public function test_both_pending_and_processing_orders_are_included(): void
    {
        $product = $this->makeProduct('SPICE-MIX');
        $this->seedStock($product, 100.0);
        $pending = $this->makeOrder(OrderStatus::NewOrder);
        $processing = $this->makeOrder(OrderStatus::InProgress);
        $this->addLine($pending, $product, 30.0);
        $this->addLine($processing, $product, 20.0);

        $result = $this->service()->analyze();

        $this->assertSame(2, $result->totalOrders);
        $this->assertCount(1, $result->demandLines);
        // Both lines for the same product are summed
        $this->assertEqualsWithDelta(50.0, $result->demandLines[0]->orderedQty, 0.001);
    }

    // ── 9. Multiple lines for same product are aggregated ────────────────────

    public function test_multiple_order_lines_for_same_product_are_summed(): void
    {
        $product = $this->makeProduct('TEA-500G');
        $this->seedStock($product, 200.0);

        $o1 = $this->makeOrder(OrderStatus::NewOrder);
        $o2 = $this->makeOrder(OrderStatus::NewOrder);
        $o3 = $this->makeOrder(OrderStatus::InProgress);
        $this->addLine($o1, $product, 50.0);
        $this->addLine($o2, $product, 70.0);
        $this->addLine($o3, $product, 80.0);

        $result = $this->service()->analyze();

        $this->assertCount(1, $result->demandLines);
        $line = $result->demandLines[0];
        $this->assertEqualsWithDelta(200.0, $line->orderedQty, 0.001); // 50+70+80
        $this->assertSame(3, $line->affectedOrdersCount);
    }

    // ── 10. Summary counts reflect correct status breakdown ───────────────────

    public function test_summary_counts_reflect_status_breakdown(): void
    {
        // READY
        $ready = $this->makeProduct('READY-P');
        $this->seedStock($ready, 100.0);
        $oR = $this->makeOrder(OrderStatus::NewOrder);
        $this->addLine($oR, $ready, 50.0);

        // SHORTAGE
        $shortage = $this->makeProduct('SHORT-P');
        $this->seedStock($shortage, 30.0);
        $oS = $this->makeOrder(OrderStatus::NewOrder);
        $this->addLine($oS, $shortage, 60.0);

        // OUT_OF_STOCK
        $oos = $this->makeProduct('OOS-P');
        $this->seedStock($oos, 0.0);
        $oO = $this->makeOrder(OrderStatus::NewOrder);
        $this->addLine($oO, $oos, 20.0);

        // UNKNOWN (no inventory record)
        $unknown = $this->makeProduct('UNK-P');
        $oU = $this->makeOrder(OrderStatus::NewOrder);
        $this->addLine($oU, $unknown, 5.0);

        $result = $this->service()->analyze();

        $this->assertSame(4, $result->totalOrders);
        $this->assertSame(4, $result->totalProducts);
        $this->assertSame(1, $result->readyCount());
        $this->assertSame(1, $result->shortageCount());
        $this->assertSame(1, $result->outOfStockCount());
        $this->assertSame(1, $result->unknownCount());
    }

    // ── 11. required_qty = MAX(0, ordered - reserved) ────────────────────────

    public function test_required_qty_is_unplanned_demand(): void
    {
        $product = $this->makeProduct('CHOC-250G');
        $this->seedStock($product, 100.0, 60.0); // 60 already reserved
        $order = $this->makeOrder(OrderStatus::NewOrder);
        $this->addLine($order, $product, 100.0);

        $result = $this->service()->analyze();

        $line = $result->demandLines[0];
        // required = ordered - reserved = 100 - 60 = 40
        $this->assertEqualsWithDelta(40.0, $line->requiredQty, 0.001);
    }

    // ── 12. Results are sorted descending by ordered_qty ─────────────────────

    public function test_demand_lines_are_sorted_descending_by_ordered_qty(): void
    {
        $p1 = $this->makeProduct('SMALL-P');
        $p2 = $this->makeProduct('LARGE-P');
        $this->seedStock($p1, 1000.0);
        $this->seedStock($p2, 1000.0);

        $o1 = $this->makeOrder(OrderStatus::NewOrder);
        $o2 = $this->makeOrder(OrderStatus::NewOrder);
        $this->addLine($o1, $p1, 10.0);  // smaller
        $this->addLine($o2, $p2, 500.0); // larger

        $result = $this->service()->analyze();

        $this->assertCount(2, $result->demandLines);
        // Larger demand comes first
        $this->assertEqualsWithDelta(500.0, $result->demandLines[0]->orderedQty, 0.001);
        $this->assertEqualsWithDelta(10.0, $result->demandLines[1]->orderedQty, 0.001);
    }

    // ── 13. Events are dispatched ─────────────────────────────────────────────

    public function test_started_and_completed_events_are_dispatched(): void
    {
        Event::fake([DemandAnalysisStarted::class, DemandAnalysisCompleted::class]);

        $this->service()->analyze();

        Event::assertDispatched(DemandAnalysisStarted::class);
        Event::assertDispatched(DemandAnalysisCompleted::class);
    }

    // ── 14. Multi-warehouse stock is correctly aggregated ─────────────────────

    public function test_stock_from_multiple_warehouses_is_summed(): void
    {
        $wh2 = Warehouse::factory()->create(['company_id' => $this->company->id]);
        $product = $this->makeProduct('MULTI-WH');

        InventoryItem::query()->create([
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $product->id,
            'company_id' => $this->company->id,
            'on_hand_qty' => 150.0,
            'reserved_qty' => 0,
        ]);
        InventoryItem::query()->create([
            'warehouse_id' => $wh2->id,
            'product_id' => $product->id,
            'company_id' => $this->company->id,
            'on_hand_qty' => 100.0,
            'reserved_qty' => 0,
        ]);

        $order = $this->makeOrder(OrderStatus::NewOrder);
        $this->addLine($order, $product, 200.0);

        $result = $this->service()->analyze();

        $line = $result->demandLines[0];
        $this->assertEqualsWithDelta(250.0, $line->availableQty, 0.001); // 150+100
        $this->assertSame(2, $line->warehouseCount);
        $this->assertSame(InventoryStatus::Ready, $line->inventoryStatus);
    }

    // ── 15. API respects date parameter ──────────────────────────────────────

    public function test_api_rejects_invalid_date_format(): void
    {
        $this->actingAs($this->user)
            ->getJson('/api/operations/demand-analysis?date=not-a-date')
            ->assertUnprocessable();
    }
}
