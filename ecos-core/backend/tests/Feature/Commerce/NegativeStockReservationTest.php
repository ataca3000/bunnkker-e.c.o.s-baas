<?php

declare(strict_types=1);

namespace Tests\Feature\Commerce;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Modules\Commerce\Orders\Application\Actions\ReserveOrderInventoryAction;
use Modules\Commerce\Orders\Domain\Enums\ReservationStatus;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Orders\Domain\Models\OrderLine;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\Recipe;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\RecipeLine;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\Sales\Customers\Domain\Models\Customer;
use Tests\TestCase;

/**
 * TASK-REGRESSION-NEGATIVE-RESERVATION-001
 *
 * Regression tests for the allow_negative_stock reservation path.
 * A product with allow_negative_stock=true MUST be reserved immediately even
 * when available_qty <= 0 — it must never enter Awaiting Stock.
 */
class NegativeStockReservationTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;

    private Warehouse $warehouse;

    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);
        $this->customer = Customer::factory()->create();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeOrder(): Order
    {
        return Order::query()->create([
            'assigned_warehouse_id' => $this->warehouse->id,
            'customer_id' => $this->customer->id,
            'order_number' => 'ORD-'.uniqid(),
            'order_date' => now()->toDateString(),
            'status' => 'in_progress',
            'subtotal' => 0,
            'total' => 0,
            'shipping_total' => 0,
            'discount_total' => 0,
            'tax_total' => 0,
        ]);
    }

    private function addLine(Order $order, Product $product, float $qty = 5.0): OrderLine
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

    // ── Scenario 1 ────────────────────────────────────────────────────────────

    /**
     * allow_negative_stock=true, available=0 → Reserved.
     * The product has no stock at all; the business rule says commit it anyway.
     */
    public function test_allow_negative_stock_with_zero_available_resolves_to_reserved(): void
    {
        $product = Product::factory()->allowsNegativeStock()->create();
        $this->seedStock($product, onHand: 0.0);
        $order = $this->makeOrder();
        $this->addLine($order, $product, qty: 5.0);

        $status = app(ReserveOrderInventoryAction::class)->execute($order);

        $this->assertSame(ReservationStatus::Reserved, $status);

        $order->refresh();
        $this->assertSame(ReservationStatus::Reserved->value, $order->reservation_status->value);

        $line = $order->lines()->where('product_id', $product->id)->firstOrFail();
        $this->assertEquals('5.0000', $line->reserved_qty);
    }

    // ── Scenario 2 ────────────────────────────────────────────────────────────

    /**
     * allow_negative_stock=false, available=0 → AwaitingStock.
     * Control: the same zero-stock situation must still produce AwaitingStock
     * when the flag is off, confirming the flag is what gates the behaviour.
     */
    public function test_allow_negative_stock_false_with_zero_available_resolves_to_awaiting_stock(): void
    {
        $product = Product::factory()->create(['allow_negative_stock' => false]);
        $this->seedStock($product, onHand: 0.0);
        $order = $this->makeOrder();
        $this->addLine($order, $product, qty: 5.0);

        $status = app(ReserveOrderInventoryAction::class)->execute($order);

        $this->assertSame(ReservationStatus::AwaitingStock, $status);

        $order->refresh();
        $this->assertSame(ReservationStatus::AwaitingStock->value, $order->reservation_status->value);
    }

    // ── Scenario 3 ────────────────────────────────────────────────────────────

    /**
     * allow_negative_stock=true, available=-5 → Reserved.
     * The inventory item already has negative available (on_hand=0, reserved=5).
     * max(0, -5)=0 inside the action — same code path as Scenario 1.
     */
    public function test_allow_negative_stock_with_negative_available_resolves_to_reserved(): void
    {
        $product = Product::factory()->allowsNegativeStock()->create();
        // availableQty() = on_hand(0) - reserved(5) = -5; action: max(0, -5) = 0
        $this->seedStock($product, onHand: 0.0, reserved: 5.0);
        $order = $this->makeOrder();
        $this->addLine($order, $product, qty: 3.0);

        $status = app(ReserveOrderInventoryAction::class)->execute($order);

        $this->assertSame(ReservationStatus::Reserved, $status);

        $order->refresh();
        $this->assertSame(ReservationStatus::Reserved->value, $order->reservation_status->value);

        $line = $order->lines()->where('product_id', $product->id)->firstOrFail();
        $this->assertEquals('3.0000', $line->reserved_qty);
    }

    // ── Scenario 4 ────────────────────────────────────────────────────────────

    /**
     * Manufacturing product, RM has allow_negative_stock=true → Reserved, manufacturing later.
     *
     * FG: can_manufacture=true, zero FG stock.
     * RM: allow_negative_stock=true, zero RM stock.
     * InventoryAvailabilityEngine sees all RM shortages as soft (allow_negative_stock) →
     * ManufacturingEligibility::Partial → allowsManufacturing()=true → Reserved.
     * The manufacturing pipeline will produce the FG after the order is committed.
     */
    public function test_manufacturing_product_with_soft_rm_shortage_resolves_to_reserved(): void
    {
        $fgProduct = Product::factory()->manufacturable()->create();
        $rmProduct = Product::factory()->rawMaterial()->allowsNegativeStock()->create();

        // Active recipe: 5 units of RM per 1 run of FG
        $recipe = Recipe::create([
            'bom_number' => 'BOM-NEGSTK-001',
            'product_id' => $fgProduct->id,
            'version' => '1.0',
            'is_active' => true,
        ]);
        RecipeLine::create([
            'bom_id' => $recipe->id,
            'raw_material_id' => $rmProduct->id,
            'quantity' => 5.0,
        ]);

        // No FG stock, no RM stock — RM shortage is soft (allow_negative_stock=true on RM)
        $order = $this->makeOrder();
        $this->addLine($order, $fgProduct, qty: 5.0);

        $status = app(ReserveOrderInventoryAction::class)->execute($order);

        $this->assertSame(ReservationStatus::Reserved, $status);

        $order->refresh();
        $this->assertSame(ReservationStatus::Reserved->value, $order->reservation_status->value);

        $line = $order->lines()->where('product_id', $fgProduct->id)->firstOrFail();
        $this->assertEquals('5.0000', $line->reserved_qty);
    }

    // ── Scenario D (TASK-ORDER-RESERVATION-ARCH-FIX-001) ──────────────────────

    /**
     * Manufacturing product, RM has allow_negative_stock=false, zero RM stock → Reserved.
     *
     * This scenario previously resolved to AwaitingStock (ARCHITECTURE VIOLATION).
     * Policy: can_manufacture=true must reserve unconditionally.
     * Manufacturing pipeline owns the RM decision — not the reservation step.
     */
    public function test_manufacturing_product_with_hard_rm_shortage_still_resolves_to_reserved(): void
    {
        $fgProduct = Product::factory()->manufacturable()->create();
        $rmProduct = Product::factory()->rawMaterial()->create(['allow_negative_stock' => false]);

        // Active recipe: 5 units of RM per production run; RM stock is zero (hard shortage)
        $recipe = Recipe::create([
            'bom_number' => 'BOM-HARDSHORT-001',
            'product_id' => $fgProduct->id,
            'version' => '1.0',
            'is_active' => true,
        ]);
        RecipeLine::create([
            'bom_id' => $recipe->id,
            'raw_material_id' => $rmProduct->id,
            'quantity' => 5.0,
        ]);

        // Zero FG, zero RM — previously this produced CannotManufacture → AwaitingStock
        $order = $this->makeOrder();
        $this->addLine($order, $fgProduct, qty: 5.0);

        $status = app(ReserveOrderInventoryAction::class)->execute($order);

        // POLICY: must be Reserved; Manufacturing handles the RM shortage separately
        $this->assertSame(ReservationStatus::Reserved, $status);

        $order->refresh();
        $this->assertSame(ReservationStatus::Reserved->value, $order->reservation_status->value);

        $line = $order->lines()->where('product_id', $fgProduct->id)->firstOrFail();
        $this->assertEquals('5.0000', $line->reserved_qty);
    }
}
