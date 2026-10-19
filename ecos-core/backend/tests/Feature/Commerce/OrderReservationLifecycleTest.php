<?php

declare(strict_types=1);

namespace Tests\Feature\Commerce;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Commerce\Orders\Application\Actions\ReleaseOrderInventoryAction;
use Modules\Commerce\Orders\Application\Actions\ReserveOrderInventoryAction;
use Modules\Commerce\Orders\Application\Actions\ShipOrderInventoryAction;
use Modules\Commerce\Orders\Application\Queries\GetOrderInventoryStatusQuery;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Exceptions\OrderAlreadyReleasedException;
use Modules\Commerce\Orders\Domain\Exceptions\OrderAlreadyReservedException;
use Modules\Commerce\Orders\Domain\Exceptions\OrderAlreadyShippedException;
use Modules\Commerce\Orders\Domain\Exceptions\OrderWarehouseNotAssignedException;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Orders\Domain\Models\OrderLine;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryReceiptLayer;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceipt;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceiptLine;
use Modules\Purchasing\Suppliers\Domain\Models\Supplier;
use Modules\Sales\Customers\Domain\Models\Customer;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;
use Tests\TestCase;
use Throwable;

/**
 * COM-010B: Order Reservation Lifecycle — reserve, ship, release, idempotency, guards.
 */
class OrderReservationLifecycleTest extends TestCase
{
    use RefreshDatabase;

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

    private function makeOrder(?string $warehouseId = null, string $status = 'in_progress'): Order
    {
        return Order::query()->create([
            'assigned_warehouse_id' => $warehouseId ?? $this->warehouse->id,
            'customer_id' => $this->customer->id,
            'order_number' => 'ORD-'.uniqid(),
            'order_date' => now()->toDateString(),
            'status' => OrderStatus::from($status)->value,
            'subtotal' => 0,
            'total' => 0,
            'shipping_total' => 0,
            'discount_total' => 0,
            'tax_total' => 0,
        ]);
    }

    private function addLine(Order $order, Product $product, float $qty = 2.0): OrderLine
    {
        return OrderLine::query()->create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'quantity' => $qty,
            'unit_price' => 50.0,
            'line_total' => $qty * 50.0,
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

    private function seedLayer(InventoryItem $item, float $qty, float $cost = 50.0): InventoryReceiptLayer
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

    // ── Reservation ───────────────────────────────────────────────────────────

    public function test_reserve_action_stamps_timestamp_and_decrements_available_qty(): void
    {
        $product = Product::factory()->create();
        $this->seedStock($product, onHand: 10.0);
        $order = $this->makeOrder();
        $this->addLine($order, $product, qty: 3.0);

        app(ReserveOrderInventoryAction::class)->execute($order);

        $order->refresh();
        $this->assertNotNull($order->inventory_reserved_at);
        $this->assertNull($order->inventory_shipped_at);
        $this->assertNull($order->inventory_released_at);

        $item = InventoryItem::query()
            ->where('product_id', $product->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->firstOrFail();

        $this->assertEquals('3.0000', $item->reserved_qty);
        $this->assertEquals(7.0, $item->availableQty());
    }

    public function test_reserve_idempotency_throws_already_reserved_exception(): void
    {
        $product = Product::factory()->create();
        $this->seedStock($product, onHand: 10.0);
        $order = $this->makeOrder();
        $this->addLine($order, $product);

        app(ReserveOrderInventoryAction::class)->execute($order);

        $this->expectException(OrderAlreadyReservedException::class);

        app(ReserveOrderInventoryAction::class)->execute($order->refresh());
    }

    public function test_reserve_throws_when_no_warehouse_assigned(): void
    {
        $order = $this->makeOrder(warehouseId: null);
        $order->update(['assigned_warehouse_id' => null]);

        $this->expectException(OrderWarehouseNotAssignedException::class);

        app(ReserveOrderInventoryAction::class)->execute($order->refresh());
    }

    public function test_reserve_throws_on_insufficient_stock(): void
    {
        $product = Product::factory()->create();
        $this->seedStock($product, onHand: 1.0); // only 1 in stock
        $order = $this->makeOrder();
        $this->addLine($order, $product, qty: 5.0); // trying to reserve 5

        $this->expectException(Throwable::class);

        app(ReserveOrderInventoryAction::class)->execute($order);
    }

    // ── Cancellation → Release ────────────────────────────────────────────────

    public function test_cancellation_releases_reservation_and_stamps_released_at(): void
    {
        $product = Product::factory()->create();
        $this->seedStock($product, onHand: 10.0);
        $order = $this->makeOrder();
        $this->addLine($order, $product, qty: 4.0);

        app(ReserveOrderInventoryAction::class)->execute($order);
        app(ReleaseOrderInventoryAction::class)->execute($order->refresh());

        $order->refresh();
        $this->assertNotNull($order->inventory_reserved_at);
        $this->assertNotNull($order->inventory_released_at);
        $this->assertNull($order->inventory_shipped_at);

        $item = InventoryItem::query()
            ->where('product_id', $product->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->firstOrFail();

        $this->assertEquals('0.0000', $item->reserved_qty);
        $this->assertEquals(10.0, $item->availableQty());
    }

    public function test_release_idempotency_throws_already_released_exception(): void
    {
        $product = Product::factory()->create();
        $this->seedStock($product, onHand: 10.0);
        $order = $this->makeOrder();
        $this->addLine($order, $product);

        app(ReserveOrderInventoryAction::class)->execute($order);
        app(ReleaseOrderInventoryAction::class)->execute($order->refresh());

        $this->expectException(OrderAlreadyReleasedException::class);

        app(ReleaseOrderInventoryAction::class)->execute($order->refresh());
    }

    public function test_release_without_prior_reservation_stamps_released_at_with_no_stock_op(): void
    {
        $product = Product::factory()->create();
        $item = $this->seedStock($product, onHand: 10.0);
        $order = $this->makeOrder(status: 'new');
        $this->addLine($order, $product);

        // Order was never reserved — release is a no-op for stock.
        app(ReleaseOrderInventoryAction::class)->execute($order);

        $order->refresh();
        $this->assertNull($order->inventory_reserved_at);
        $this->assertNotNull($order->inventory_released_at);

        $item->refresh();
        $this->assertEquals('0.0000', $item->reserved_qty);
    }

    // ── Completion → Ship ─────────────────────────────────────────────────────

    public function test_completion_ships_inventory_and_stamps_shipped_at(): void
    {
        $product = Product::factory()->create();
        $item = $this->seedStock($product, onHand: 10.0);
        $this->seedLayer($item, qty: 10.0);
        $order = $this->makeOrder();
        $this->addLine($order, $product, qty: 3.0);

        app(ReserveOrderInventoryAction::class)->execute($order);
        app(ShipOrderInventoryAction::class)->execute($order->refresh());

        $order->refresh();
        $this->assertNotNull($order->inventory_reserved_at);
        $this->assertNotNull($order->inventory_shipped_at);
        $this->assertNull($order->inventory_released_at);

        $item = InventoryItem::query()
            ->where('product_id', $product->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->firstOrFail();

        $this->assertEquals('7.0000', $item->on_hand_qty);
        $this->assertEquals('0.0000', $item->reserved_qty);
    }

    public function test_ship_idempotency_throws_already_shipped_exception(): void
    {
        $product = Product::factory()->create();
        $item = $this->seedStock($product, onHand: 10.0);
        $this->seedLayer($item, qty: 10.0);
        $order = $this->makeOrder();
        $this->addLine($order, $product, qty: 2.0);

        app(ReserveOrderInventoryAction::class)->execute($order);
        app(ShipOrderInventoryAction::class)->execute($order->refresh());

        $this->expectException(OrderAlreadyShippedException::class);

        app(ShipOrderInventoryAction::class)->execute($order->refresh());
    }

    public function test_ship_throws_when_inventory_not_reserved(): void
    {
        $product = Product::factory()->create();
        $this->seedStock($product, onHand: 10.0);
        $order = $this->makeOrder();
        $this->addLine($order, $product);

        // Ship without reserving first
        $this->expectException(UnprocessableEntityHttpException::class);

        app(ShipOrderInventoryAction::class)->execute($order);
    }

    // ── GetOrderInventoryStatusQuery ──────────────────────────────────────────

    public function test_inventory_status_query_reflects_lifecycle_state(): void
    {
        $product = Product::factory()->create();
        $item = $this->seedStock($product, onHand: 10.0);
        $this->seedLayer($item, qty: 10.0);
        $order = $this->makeOrder();
        $this->addLine($order, $product, qty: 2.0);

        $query = app(GetOrderInventoryStatusQuery::class);

        $initial = $query->execute($order->id);
        $this->assertFalse($initial['reserved']);
        $this->assertFalse($initial['shipped']);
        $this->assertFalse($initial['released']);

        app(ReserveOrderInventoryAction::class)->execute($order);

        $afterReserve = $query->execute($order->id);
        $this->assertTrue($afterReserve['reserved']);
        $this->assertFalse($afterReserve['shipped']);
        $this->assertNotNull($afterReserve['inventory_reserved_at']);

        app(ShipOrderInventoryAction::class)->execute($order->refresh());

        $afterShip = $query->execute($order->id);
        $this->assertTrue($afterShip['shipped']);
        $this->assertNotNull($afterShip['inventory_shipped_at']);
    }
}
