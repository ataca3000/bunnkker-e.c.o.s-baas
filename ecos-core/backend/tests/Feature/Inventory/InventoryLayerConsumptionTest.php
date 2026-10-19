<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Modules\Commerce\Orders\Application\Actions\ReserveOrderInventoryAction;
use Modules\Commerce\Orders\Application\Actions\ShipOrderInventoryAction;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Orders\Domain\Models\OrderLine;
use Modules\Inventory\InventoryItems\Domain\Exceptions\InsufficientStockException;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Inventory\ReceiptLayers\Application\Services\InventoryLayerConsumptionService;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryLayerConsumption;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryReceiptLayer;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceipt;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceiptLine;
use Modules\Purchasing\Suppliers\Domain\Models\Supplier;
use Modules\Sales\Customers\Domain\Models\Customer;
use Tests\TestCase;
use Throwable;

/**
 * COM-010D: FIFO Layer Consumption Engine
 */
class InventoryLayerConsumptionTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;

    private Warehouse $warehouse;

    private Customer $customer;

    private Supplier $supplier;

    protected function setUp(): void
    {
        parent::setUp();
        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);
        $this->customer = Customer::factory()->create();
        $this->supplier = Supplier::factory()->create();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeProduct(): Product
    {
        return Product::factory()->create([
            'regular_price' => 200.0,
            'sale_price' => 200.0,
        ]);
    }

    private function seedItem(Product $product, float $onHand, float $reserved = 0.0): InventoryItem
    {
        return InventoryItem::query()->create([
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $product->id,
            'company_id' => $this->company->id,
            'on_hand_qty' => $onHand,
            'reserved_qty' => $reserved,
        ]);
    }

    private function addLayer(InventoryItem $item, float $qty, float $cost, ?string $receiptDate = null): InventoryReceiptLayer
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
            'receipt_date' => $receiptDate ?? now()->toDateString(),
        ]);
    }

    private function makeOrder(float $total = 500.0): Order
    {
        return Order::query()->create([
            'assigned_warehouse_id' => $this->warehouse->id,
            'customer_id' => $this->customer->id,
            'order_number' => 'ORD-'.uniqid(),
            'order_date' => now()->toDateString(),
            'status' => OrderStatus::InProgress->value,
            'subtotal' => $total,
            'total' => $total,
            'shipping_total' => 0,
            'discount_total' => 0,
            'tax_total' => 0,
        ]);
    }

    private function addOrderLine(Order $order, Product $product, float $qty, float $price = 100.0): OrderLine
    {
        return OrderLine::query()->create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'quantity' => $qty,
            'unit_price' => $price,
            'line_total' => $qty * $price,
        ]);
    }

    private function service(): InventoryLayerConsumptionService
    {
        return app(InventoryLayerConsumptionService::class);
    }

    // ── 1. Single layer consume ───────────────────────────────────────────────

    public function test_single_layer_fully_consumed(): void
    {
        $product = $this->makeProduct();
        $item = $this->seedItem($product, onHand: 10.0);
        $layer = $this->addLayer($item, qty: 10.0, cost: 100.0);

        $result = $this->service()->consume(
            inventoryItemId: $item->id,
            productId: $product->id,
            warehouseId: $this->warehouse->id,
            companyId: $this->company->id,
            quantity: 10.0,
            orderId: 'fake-order-id',
        );

        $this->assertEquals(10.0, $result->totalQuantity);
        $this->assertEquals(1000.0, $result->totalCost);
        $this->assertEquals(100.0, $result->weightedCost);
        $this->assertCount(1, $result->consumedLayers);

        $layer->refresh();
        $this->assertEquals('0.0000', $layer->remaining_qty);
    }

    // ── 2. Multi-layer consume ────────────────────────────────────────────────

    public function test_multi_layer_fifo_consume(): void
    {
        $product = $this->makeProduct();
        $item = $this->seedItem($product, onHand: 20.0);

        // Layer 1: 10 KG @ 100, created first
        $this->addLayer($item, qty: 10.0, cost: 100.0, receiptDate: '2026-01-01');
        // Layer 2: 10 KG @ 200, created second
        $this->addLayer($item, qty: 10.0, cost: 200.0, receiptDate: '2026-02-01');

        // Ship 15 → should take all of Layer1 + 5 from Layer2
        $result = $this->service()->consume(
            inventoryItemId: $item->id,
            productId: $product->id,
            warehouseId: $this->warehouse->id,
            companyId: $this->company->id,
            quantity: 15.0,
        );

        // COGS = (10 × 100) + (5 × 200) = 2,000
        $this->assertEquals(15.0, $result->totalQuantity);
        $this->assertEquals(2000.0, $result->totalCost);
        $this->assertCount(2, $result->consumedLayers);
    }

    // ── 3. Exact layer depletion ──────────────────────────────────────────────

    public function test_exact_layer_depletion_sets_remaining_to_zero(): void
    {
        $product = $this->makeProduct();
        $item = $this->seedItem($product, onHand: 5.0);
        $layer = $this->addLayer($item, qty: 5.0, cost: 50.0);

        $this->service()->consume(
            inventoryItemId: $item->id,
            productId: $product->id,
            warehouseId: $this->warehouse->id,
            companyId: $this->company->id,
            quantity: 5.0,
        );

        $this->assertEquals('0.0000', $layer->fresh()->remaining_qty);
    }

    // ── 4. Partial layer depletion ────────────────────────────────────────────

    public function test_partial_layer_depletion_leaves_correct_remaining(): void
    {
        $product = $this->makeProduct();
        $item = $this->seedItem($product, onHand: 10.0);
        $layer = $this->addLayer($item, qty: 10.0, cost: 80.0);

        $this->service()->consume(
            inventoryItemId: $item->id,
            productId: $product->id,
            warehouseId: $this->warehouse->id,
            companyId: $this->company->id,
            quantity: 3.0,
        );

        $this->assertEquals('7.0000', $layer->fresh()->remaining_qty);
    }

    // ── 5. Insufficient layers ────────────────────────────────────────────────

    public function test_insufficient_layers_throws_exception(): void
    {
        $product = $this->makeProduct();
        $item = $this->seedItem($product, onHand: 5.0);
        $this->addLayer($item, qty: 5.0, cost: 100.0);

        $this->expectException(InsufficientStockException::class);

        $this->service()->consume(
            inventoryItemId: $item->id,
            productId: $product->id,
            warehouseId: $this->warehouse->id,
            companyId: $this->company->id,
            quantity: 10.0,
        );
    }

    // ── 6. Shipment rollback on failure ───────────────────────────────────────

    public function test_shipment_rolls_back_if_fifo_fails(): void
    {
        $product = $this->makeProduct();
        $item = $this->seedItem($product, onHand: 10.0, reserved: 10.0);
        // No layers — FIFO will fail

        $order = $this->makeOrder();
        $this->addOrderLine($order, $product, qty: 10.0);

        try {
            app(ShipOrderInventoryAction::class)->execute($order->refresh());
            $this->fail('Expected exception was not thrown');
        } catch (Throwable) {
            // Assert no InventoryLayerConsumption rows were created
            $this->assertEquals(0, InventoryLayerConsumption::query()->count());

            // Assert inventory was NOT reduced (transaction rolled back)
            $item->refresh();
            $this->assertEquals('10.0000', $item->on_hand_qty);
        }
    }

    // ── 7. Consumption records created ───────────────────────────────────────

    public function test_consumption_audit_records_created(): void
    {
        $product = $this->makeProduct();
        $item = $this->seedItem($product, onHand: 10.0);
        $this->addLayer($item, qty: 10.0, cost: 100.0);

        $order = $this->makeOrder(total: 1000.0);
        $this->addOrderLine($order, $product, qty: 10.0, price: 100.0);

        app(ReserveOrderInventoryAction::class)->execute($order);
        app(ShipOrderInventoryAction::class)->execute($order->refresh());

        $consumptions = InventoryLayerConsumption::query()
            ->where('order_id', $order->id)
            ->get();

        $this->assertCount(1, $consumptions);
        $this->assertEquals('10.0000', $consumptions->first()->quantity);
        $this->assertEquals('100.0000', $consumptions->first()->unit_cost);
        $this->assertEquals('1000.0000', $consumptions->first()->total_cost);
    }

    // ── 8. FIFO order respected ───────────────────────────────────────────────

    public function test_fifo_order_is_respected_oldest_consumed_first(): void
    {
        $product = $this->makeProduct();
        $item = $this->seedItem($product, onHand: 20.0);

        // Older layer @ 50, newer @ 150
        $old = $this->addLayer($item, qty: 10.0, cost: 50.0, receiptDate: '2026-01-01');
        $new = $this->addLayer($item, qty: 10.0, cost: 150.0, receiptDate: '2026-06-01');

        $result = $this->service()->consume(
            inventoryItemId: $item->id,
            productId: $product->id,
            warehouseId: $this->warehouse->id,
            companyId: $this->company->id,
            quantity: 5.0,
        );

        // Should consume from oldest (@ 50), not newest
        $this->assertEquals(50.0, $result->weightedCost);
        $this->assertEquals('5.0000', $old->fresh()->remaining_qty);
        $this->assertEquals('10.0000', $new->fresh()->remaining_qty);
    }

    // ── 9. current_fifo_cost recalculated ────────────────────────────────────

    public function test_current_fifo_cost_updated_after_shipment(): void
    {
        $product = $this->makeProduct();
        $item = $this->seedItem($product, onHand: 20.0);

        $this->addLayer($item, qty: 10.0, cost: 100.0, receiptDate: '2026-01-01');
        $this->addLayer($item, qty: 10.0, cost: 200.0, receiptDate: '2026-06-01');

        $order = $this->makeOrder(total: 1000.0);
        $this->addOrderLine($order, $product, qty: 10.0, price: 100.0);

        app(ReserveOrderInventoryAction::class)->execute($order);
        app(ShipOrderInventoryAction::class)->execute($order->refresh());

        // After consuming first layer (@ 100), current FIFO cost should be 200
        $this->assertEquals(200.0, $product->fresh()->current_fifo_cost);
    }

    // ── 10. Supplier analytics updated ───────────────────────────────────────

    public function test_supplier_analytics_reflect_remaining_layers_after_consumption(): void
    {
        $product = $this->makeProduct();
        $item = $this->seedItem($product, onHand: 10.0);
        $this->addLayer($item, qty: 10.0, cost: 100.0);

        $order = $this->makeOrder(total: 1000.0);
        $this->addOrderLine($order, $product, qty: 6.0, price: 100.0);

        app(ReserveOrderInventoryAction::class)->execute($order);
        app(ShipOrderInventoryAction::class)->execute($order->refresh());

        $analytics = app(\Modules\Purchasing\Suppliers\Application\Queries\GetSupplierAnalyticsQuery::class)
            ->execute($this->supplier->id);

        // Remaining 4 units @ 100 = 400
        $this->assertEquals(400.0, $analytics['inventory_remaining_cost']);
    }

    // ── 11. Order actual COGS calculated ─────────────────────────────────────

    public function test_order_actual_cogs_stored_after_shipment(): void
    {
        $product = $this->makeProduct();
        $item = $this->seedItem($product, onHand: 10.0);
        $this->addLayer($item, qty: 10.0, cost: 80.0);

        $order = $this->makeOrder(total: 1000.0);
        $this->addOrderLine($order, $product, qty: 10.0, price: 100.0);

        app(ReserveOrderInventoryAction::class)->execute($order);
        app(ShipOrderInventoryAction::class)->execute($order->refresh());

        $order->refresh();
        $this->assertEquals(800.0, $order->actual_cogs_amount); // 10 × 80
    }

    // ── 12. Order actual margin calculated ───────────────────────────────────

    public function test_order_actual_margin_calculated(): void
    {
        $product = $this->makeProduct();
        $item = $this->seedItem($product, onHand: 10.0);
        $this->addLayer($item, qty: 10.0, cost: 60.0);

        // Order total = 1000, COGS = 600
        $order = $this->makeOrder(total: 1000.0);
        $this->addOrderLine($order, $product, qty: 10.0, price: 100.0);

        app(ReserveOrderInventoryAction::class)->execute($order);
        app(ShipOrderInventoryAction::class)->execute($order->refresh());

        $order->refresh();
        $this->assertEquals(400.0, $order->actual_margin_amount);  // 1000 - 600
        $this->assertEquals(40.0, $order->actual_margin_percent);   // 40%
    }
}
