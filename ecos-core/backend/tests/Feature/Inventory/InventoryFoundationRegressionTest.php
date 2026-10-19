<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use BackedEnum;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Modules\Commerce\Orders\Application\Actions\ReserveOrderInventoryAction;
use Modules\Commerce\Orders\Application\Actions\ShipOrderInventoryAction;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Enums\ReservationStatus;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Orders\Domain\Models\OrderLine;
use Modules\Commerce\Orders\Domain\Models\OrderReservationAudit;
use Modules\Inventory\InventoryItems\Domain\Contracts\InventoryItemRepositoryInterface;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\InventoryItems\Domain\Models\StockLedgerEntry;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Inventory\ReceiptLayers\Application\Services\InventoryLayerConsumptionService;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryReceiptLayer;
use Modules\Inventory\StockLedger\Application\Actions\AddManualStockAction;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceipt;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceiptLine;
use Modules\Purchasing\Suppliers\Domain\Models\Supplier;
use Modules\Sales\Customers\Domain\Models\Customer;
use Tests\TestCase;

/**
 * TASK-INV-CRITICAL-FOUNDATION-001 regression suite
 *
 * Covers F-INV-C1 (FIFO schema), F-INV-C2 (manual stock path), F-INV-H6 (atomicity).
 */
class InventoryFoundationRegressionTest extends TestCase
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

    // ═══════════════════════════════════════════════════════════════════════════
    // F-INV-C1: FIFO schema fix
    // ═══════════════════════════════════════════════════════════════════════════

    /** F-INV-C1-01: receipt layer stores company_id */
    public function test_receipt_layer_stores_company_id(): void
    {
        $product = $this->makeProduct();
        $item = $this->seedItem($product, 10.0);
        $layer = $this->addLayer($item, 10.0, 100.0);

        $this->assertNotNull($layer->company_id);
        $this->assertEquals($this->company->id, $layer->company_id);
    }

    /** F-INV-C1-02: consume() succeeds — no SQL column-not-found error */
    public function test_consume_succeeds_with_company_id_filter(): void
    {
        $product = $this->makeProduct();
        $item = $this->seedItem($product, 10.0);
        $this->addLayer($item, 10.0, 100.0);

        $result = app(InventoryLayerConsumptionService::class)->consume(
            inventoryItemId: $item->id,
            productId: $product->id,
            warehouseId: $this->warehouse->id,
            companyId: $this->company->id,
            quantity: 10.0,
        );

        $this->assertEquals(10.0, $result->totalQuantity);
        $this->assertEquals(1000.0, $result->totalCost);
    }

    /** F-INV-C1-03: tenant isolation — Company B cannot consume Company A's layers */
    public function test_tenant_isolation_company_b_cannot_consume_company_a_layers(): void
    {
        $companyB = Company::factory()->create();
        $warehouseB = Warehouse::factory()->create(['company_id' => $companyB->id]);
        $product = $this->makeProduct();

        // Seed InventoryItem for Company B
        $itemB = InventoryItem::query()->create([
            'warehouse_id' => $warehouseB->id,
            'product_id' => $product->id,
            'company_id' => $companyB->id,
            'on_hand_qty' => 10.0,
            'reserved_qty' => 0.0,
        ]);

        // Add a layer belonging to Company A's warehouse
        $this->addLayer($this->seedItem($product, 10.0), 10.0, 100.0);

        // Company B tries to consume — should find no layers (InsufficientStockException)
        $this->expectException(\Modules\Inventory\InventoryItems\Domain\Exceptions\InsufficientStockException::class);

        app(InventoryLayerConsumptionService::class)->consume(
            inventoryItemId: $itemB->id,
            productId: $product->id,
            warehouseId: $warehouseB->id,
            companyId: $companyB->id,
            quantity: 5.0,
        );
    }

    /** F-INV-C1-04: goods receipt layer carries company_id through full shipment */
    public function test_goods_receipt_layer_carries_company_id(): void
    {
        $product = $this->makeProduct();
        $item = $this->seedItem($product, 10.0);
        $layer = $this->addLayer($item, 10.0, 80.0);

        $this->assertEquals($this->company->id, $layer->company_id);

        $order = $this->makeOrder(1000.0);
        $this->addOrderLine($order, $product, 10.0, 100.0);

        app(ReserveOrderInventoryAction::class)->execute($order);
        app(ShipOrderInventoryAction::class)->execute($order->refresh());

        $order->refresh();
        $this->assertEquals(800.0, $order->actual_cogs_amount);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // F-INV-C2: manual stock write path
    // ═══════════════════════════════════════════════════════════════════════════

    /** F-INV-C2-01: manual add updates InventoryItem.on_hand_qty */
    public function test_manual_add_updates_inventory_item_on_hand(): void
    {
        $product = $this->makeProduct();
        $item = $this->seedItem($product, 0.0);

        app(AddManualStockAction::class)->execute($product, $this->warehouse, 10.0, [
            'unit_cost' => 50.0,
        ]);

        $this->assertEquals(10.0, (float) $item->fresh()->on_hand_qty);
    }

    /** F-INV-C2-02: manual add creates a StockLedgerEntry of type AdjustmentIn */
    public function test_manual_add_creates_stock_ledger_entry(): void
    {
        $product = $this->makeProduct();
        $this->seedItem($product, 0.0);

        app(AddManualStockAction::class)->execute($product, $this->warehouse, 10.0, [
            'unit_cost' => 50.0,
            'notes' => 'opening stock',
        ]);

        $entry = StockLedgerEntry::query()
            ->where('product_id', $product->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->latest()
            ->first();

        $this->assertNotNull($entry);
        $movementType = $entry->movement_type instanceof BackedEnum ? $entry->movement_type->value : (string) $entry->movement_type;
        $this->assertEquals('adjustment_in', $movementType);
        $this->assertEquals(10.0, (float) $entry->quantity);
        $this->assertEquals($this->company->id, $entry->company_id);
    }

    /** F-INV-C2-03: manual add creates a FIFO layer with company_id */
    public function test_manual_add_creates_fifo_layer_with_company_id(): void
    {
        $product = $this->makeProduct();
        $this->seedItem($product, 0.0);

        app(AddManualStockAction::class)->execute($product, $this->warehouse, 5.0, [
            'unit_cost' => 80.0,
        ]);

        $layer = InventoryReceiptLayer::query()
            ->where('product_id', $product->id)
            ->where('warehouse_id', $this->warehouse->id)
            ->whereNull('goods_receipt_id')
            ->first();

        $this->assertNotNull($layer);
        $this->assertEquals($this->company->id, $layer->company_id);
        $this->assertEquals(5.0, (float) $layer->received_qty);
        $this->assertEquals(80.0, (float) $layer->landed_unit_cost);
    }

    /** F-INV-C2-04: manually added stock is consumable by the FIFO engine */
    public function test_manually_added_stock_is_fifo_consumable(): void
    {
        $product = $this->makeProduct();
        $this->seedItem($product, 0.0);

        app(AddManualStockAction::class)->execute($product, $this->warehouse, 10.0, [
            'unit_cost' => 60.0,
        ]);

        $item = app(InventoryItemRepositoryInterface::class)
            ->findByWarehouseAndProduct($this->warehouse->id, $product->id);

        $result = app(InventoryLayerConsumptionService::class)->consume(
            inventoryItemId: $item->id,
            productId: $product->id,
            warehouseId: $this->warehouse->id,
            companyId: $this->company->id,
            quantity: 10.0,
        );

        $this->assertEquals(10.0, $result->totalQuantity);
        $this->assertEquals(600.0, $result->totalCost);
    }

    /** F-INV-C2-05: FIFO order preserved across manual + GR layers */
    public function test_fifo_order_preserved_across_manual_and_gr_layers(): void
    {
        $product = $this->makeProduct();
        $item = $this->seedItem($product, 0.0);

        // Manual add @ 40 (should be consumed first)
        app(AddManualStockAction::class)->execute($product, $this->warehouse, 5.0, [
            'unit_cost' => 40.0,
        ]);

        // GR layer @ 120 (added later — consumed second)
        $item->refresh();
        $item->on_hand_qty = (float) $item->on_hand_qty + 5.0;
        $item->save();
        $this->addLayer($item, 5.0, 120.0);

        $freshItem = app(InventoryItemRepositoryInterface::class)
            ->findByWarehouseAndProduct($this->warehouse->id, $product->id);

        $result = app(InventoryLayerConsumptionService::class)->consume(
            inventoryItemId: $freshItem->id,
            productId: $product->id,
            warehouseId: $this->warehouse->id,
            companyId: $this->company->id,
            quantity: 5.0,
        );

        // Must consume the manual (@ 40) layer first
        $this->assertEquals(40.0, $result->weightedCost);
        $this->assertEquals(200.0, $result->totalCost);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // F-INV-H6: atomicity — audit inside transaction
    // ═══════════════════════════════════════════════════════════════════════════

    /** F-INV-H6-01: audit record exists after a successful shipment */
    public function test_audit_record_exists_after_shipment(): void
    {
        $product = $this->makeProduct();
        $item = $this->seedItem($product, 10.0, 10.0);
        $this->addLayer($item, 10.0, 100.0);

        $order = $this->makeOrder(1000.0);
        $this->addOrderLine($order, $product, 10.0, 100.0);

        app(ReserveOrderInventoryAction::class)->execute($order);
        app(ShipOrderInventoryAction::class)->execute($order->refresh());

        $audit = OrderReservationAudit::query()
            ->where('order_id', $order->id)
            ->where('to_status', ReservationStatus::Transferred->value)
            ->first();

        $this->assertNotNull($audit, 'Audit record must exist after shipment');
        $this->assertEquals(ReservationStatus::Transferred->value, $audit->to_status);
    }

    /** F-INV-H6-02: audit record exists for multi-line order shipment */
    public function test_audit_record_exists_for_multi_line_shipment(): void
    {
        $p1 = $this->makeProduct();
        $p2 = $this->makeProduct();

        $i1 = $this->seedItem($p1, 5.0, 5.0);
        $i2 = $this->seedItem($p2, 3.0, 3.0);

        $this->addLayer($i1, 5.0, 100.0);
        $this->addLayer($i2, 3.0, 200.0);

        $order = $this->makeOrder(1100.0);
        $this->addOrderLine($order, $p1, 5.0, 100.0);
        $this->addOrderLine($order, $p2, 3.0, 200.0);

        app(ReserveOrderInventoryAction::class)->execute($order);
        app(ShipOrderInventoryAction::class)->execute($order->refresh());

        $auditCount = OrderReservationAudit::query()
            ->where('order_id', $order->id)
            ->where('to_status', ReservationStatus::Transferred->value)
            ->count();

        $this->assertEquals(1, $auditCount, 'Exactly one audit transition record per shipment');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Regression: existing paths must not corrupt qty
    // ═══════════════════════════════════════════════════════════════════════════

    /** REG-01: reservation does not corrupt on_hand_qty */
    public function test_reservation_does_not_corrupt_on_hand_qty(): void
    {
        $product = $this->makeProduct();
        $item = $this->seedItem($product, 10.0);
        $this->addLayer($item, 10.0, 100.0);

        $order = $this->makeOrder(1000.0);
        $this->addOrderLine($order, $product, 6.0, 100.0);

        app(ReserveOrderInventoryAction::class)->execute($order);

        $item->refresh();
        $this->assertEquals(10.0, (float) $item->on_hand_qty, 'Reservation must not reduce on_hand');
        $this->assertEquals(6.0, (float) $item->reserved_qty);
    }
}
