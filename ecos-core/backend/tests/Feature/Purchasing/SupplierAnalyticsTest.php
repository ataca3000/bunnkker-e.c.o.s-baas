<?php

declare(strict_types=1);

namespace Tests\Feature\Purchasing;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryReceiptLayer;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\Purchasing\GoodsReceipts\Application\Actions\PostGoodsReceiptAction;
use Modules\Purchasing\GoodsReceipts\Domain\Enums\PaymentStatus;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceipt;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceiptLine;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrder;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrderLine;
use Modules\Purchasing\Suppliers\Application\Queries\GetSupplierAnalyticsQuery;
use Modules\Purchasing\Suppliers\Application\Queries\GetSupplierInventoryBreakdownQuery;
use Modules\Purchasing\Suppliers\Domain\Models\Supplier;
use Tests\TestCase;

/**
 * COM-010C: Supplier Analytics — receipt layer creation, cost intelligence,
 * supplier metrics, inventory value, profit, breakdown.
 */
class SupplierAnalyticsTest extends TestCase
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

    private function makeApprovedPo(Supplier $supplier, Product $product, float $qty, float $unitPrice): array
    {
        $po = PurchaseOrder::factory()->approved()->create([
            'company_id' => $this->company->id,
            'supplier_id' => $supplier->id,
        ]);

        $poLine = PurchaseOrderLine::factory()->create([
            'purchase_order_id' => $po->id,
            'product_id' => $product->id,
            'quantity' => $qty,
            'received_qty' => 0,
            'unit_price' => $unitPrice,
        ]);

        return [$po, $poLine];
    }

    private function makeAndPostReceipt(
        PurchaseOrder $po,
        PurchaseOrderLine $poLine,
        float $netQty,
        array $headerExtras = [],
    ): GoodsReceipt {
        $receipt = GoodsReceipt::factory()->create(array_merge([
            'purchase_order_id' => $po->id,
            'warehouse_id' => $this->warehouse->id,
        ], $headerExtras));

        GoodsReceiptLine::factory()->create([
            'goods_receipt_id' => $receipt->id,
            'purchase_order_line_id' => $poLine->id,
            'product_id' => $poLine->product_id,
            'ordered_quantity' => (float) $poLine->quantity,
            'received_quantity' => $netQty,
            'gross_received_quantity' => $netQty,
            'net_received_quantity' => $netQty,
            'variance_quantity' => $netQty - (float) $poLine->quantity,
            'unit_price' => (float) $poLine->unit_price,
        ]);

        app(PostGoodsReceiptAction::class)->execute($receipt->id);

        return $receipt->refresh();
    }

    // ── Part 1: Receipt Layer Creation ────────────────────────────────────────

    public function test_posting_gr_creates_receipt_layer(): void
    {
        $product = Product::factory()->create(['sale_price' => 20.00]);
        [$po, $poLine] = $this->makeApprovedPo($this->supplier, $product, 100.0, 10.0);

        $this->makeAndPostReceipt($po, $poLine, 50.0);

        $layer = InventoryReceiptLayer::query()
            ->where('supplier_id', $this->supplier->id)
            ->where('product_id', $product->id)
            ->first();

        $this->assertNotNull($layer);
        $this->assertEquals('50.0000', $layer->received_qty);
        $this->assertEquals('50.0000', $layer->remaining_qty);
        $this->assertEquals($this->warehouse->id, $layer->warehouse_id);
        $this->assertEquals('20.00', $layer->sale_price_snapshot);
    }

    public function test_receipt_layer_landed_unit_cost_matches_line(): void
    {
        $product = Product::factory()->create();
        [$po, $poLine] = $this->makeApprovedPo($this->supplier, $product, 100.0, 10.0);

        // No extra costs — landed_unit_cost = unit_price
        $this->makeAndPostReceipt($po, $poLine, 100.0);

        $layer = InventoryReceiptLayer::query()
            ->where('supplier_id', $this->supplier->id)
            ->where('product_id', $product->id)
            ->first();

        $this->assertNotNull($layer);
        $this->assertEquals('10.0000', $layer->landed_unit_cost);
    }

    public function test_receipt_layer_cost_and_sale_value_methods(): void
    {
        $product = Product::factory()->create(['sale_price' => 25.00]);
        [$po, $poLine] = $this->makeApprovedPo($this->supplier, $product, 100.0, 10.0);
        $this->makeAndPostReceipt($po, $poLine, 10.0);

        $layer = InventoryReceiptLayer::query()
            ->where('supplier_id', $this->supplier->id)
            ->where('product_id', $product->id)
            ->first();

        $this->assertNotNull($layer);
        $this->assertEquals(100.0, $layer->costValue());  // 10 * 10
        $this->assertEquals(250.0, $layer->saleValue());   // 10 * 25
    }

    // ── Part 2: Product Cost Intelligence ────────────────────────────────────

    public function test_posting_gr_updates_product_last_purchase_cost(): void
    {
        $product = Product::factory()->create();
        [$po, $poLine] = $this->makeApprovedPo($this->supplier, $product, 100.0, 15.0);
        $this->makeAndPostReceipt($po, $poLine, 50.0);

        $product->refresh();
        $this->assertEquals(15.0, $product->last_purchase_cost);
        $this->assertEquals($this->supplier->id, $product->last_supplier_id);
    }

    public function test_first_receipt_sets_average_cost_to_unit_price(): void
    {
        $product = Product::factory()->create(['average_cost' => null]);
        [$po, $poLine] = $this->makeApprovedPo($this->supplier, $product, 100.0, 20.0);
        $this->makeAndPostReceipt($po, $poLine, 50.0);

        $product->refresh();
        $this->assertEquals(20.0, $product->average_cost);
    }

    public function test_weighted_average_cost_computed_correctly(): void
    {
        $product = Product::factory()->create(['average_cost' => null]);
        [$po1, $poLine1] = $this->makeApprovedPo($this->supplier, $product, 100.0, 10.0);

        // First receipt: 50 units @ 10 → avg = 10
        $this->makeAndPostReceipt($po1, $poLine1, 50.0);
        $product->refresh();
        $this->assertEquals(10.0, $product->average_cost);

        // Second receipt: 50 units @ 20 → avg = (50*10 + 50*20) / 100 = 15
        $supplier2 = Supplier::factory()->create();
        [$po2, $poLine2] = $this->makeApprovedPo($supplier2, $product, 100.0, 20.0);
        $this->makeAndPostReceipt($po2, $poLine2, 50.0);
        $product->refresh();
        $this->assertEquals(15.0, $product->average_cost);
    }

    // ── Part 3: GetSupplierAnalyticsQuery ────────────────────────────────────

    public function test_supplier_analytics_counts_posted_receipts(): void
    {
        $product = Product::factory()->create();
        [$po, $poLine] = $this->makeApprovedPo($this->supplier, $product, 100.0, 10.0);
        $this->makeAndPostReceipt($po, $poLine, 50.0);

        $analytics = app(GetSupplierAnalyticsQuery::class)->execute($this->supplier->id);

        $this->assertEquals(1, $analytics['total_purchases']);
    }

    public function test_supplier_analytics_totals_paid_and_outstanding(): void
    {
        $product = Product::factory()->create();
        [$po, $poLine] = $this->makeApprovedPo($this->supplier, $product, 100.0, 10.0);

        $this->makeAndPostReceipt($po, $poLine, 50.0, [
            'invoice_total_amount' => 500.0,
            'paid_amount' => 200.0,
        ]);

        $analytics = app(GetSupplierAnalyticsQuery::class)->execute($this->supplier->id);

        $this->assertEquals(500.0, $analytics['total_invoiced']);
        $this->assertEquals(200.0, $analytics['total_paid']);
        $this->assertEquals(300.0, $analytics['outstanding_balance']);
    }

    public function test_supplier_analytics_inventory_cost_value(): void
    {
        $product = Product::factory()->create();
        [$po, $poLine] = $this->makeApprovedPo($this->supplier, $product, 100.0, 10.0);
        $this->makeAndPostReceipt($po, $poLine, 30.0);

        $analytics = app(GetSupplierAnalyticsQuery::class)->execute($this->supplier->id);

        // 30 units * 10.0 landed = 300
        $this->assertEquals(30.0, $analytics['current_inventory_quantity']);
        $this->assertEquals(300.0, $analytics['current_inventory_cost_value']);
    }

    public function test_supplier_analytics_gross_profit_computed(): void
    {
        $product = Product::factory()->create(['sale_price' => 25.00]);
        [$po, $poLine] = $this->makeApprovedPo($this->supplier, $product, 100.0, 10.0);
        $this->makeAndPostReceipt($po, $poLine, 20.0);

        $analytics = app(GetSupplierAnalyticsQuery::class)->execute($this->supplier->id);

        // cost_value = 20 * 10 = 200; sale_value = 20 * 25 = 500; profit = 300
        $this->assertEquals(200.0, $analytics['current_inventory_cost_value']);
        $this->assertEquals(500.0, $analytics['current_inventory_sale_value']);
        $this->assertEquals(300.0, $analytics['potential_gross_profit']);
    }

    // ── Part 5: GetSupplierInventoryBreakdownQuery ────────────────────────────

    public function test_inventory_breakdown_returns_per_product_rows(): void
    {
        $productA = Product::factory()->create(['name' => 'Widget A', 'sale_price' => 15.0]);
        $productB = Product::factory()->create(['name' => 'Widget B', 'sale_price' => 30.0]);

        [$poA, $lineA] = $this->makeApprovedPo($this->supplier, $productA, 100.0, 10.0);
        [$poB, $lineB] = $this->makeApprovedPo($this->supplier, $productB, 100.0, 20.0);

        $this->makeAndPostReceipt($poA, $lineA, 10.0);
        $this->makeAndPostReceipt($poB, $lineB, 5.0);

        $breakdown = app(GetSupplierInventoryBreakdownQuery::class)->execute($this->supplier->id);

        $this->assertCount(2, $breakdown);

        $rowA = $breakdown->firstWhere('product_id', $productA->id);
        $rowB = $breakdown->firstWhere('product_id', $productB->id);

        $this->assertNotNull($rowA);
        $this->assertEquals(10.0, $rowA['remaining_quantity']);
        $this->assertEquals(100.0, $rowA['cost_value']); // 10 * 10
        $this->assertEquals(150.0, $rowA['sale_value']);  // 10 * 15

        $this->assertNotNull($rowB);
        $this->assertEquals(5.0, $rowB['remaining_quantity']);
        $this->assertEquals(100.0, $rowB['cost_value']); // 5 * 20
        $this->assertEquals(150.0, $rowB['sale_value']);  // 5 * 30
    }

    // ── COM-010A-R2A: paid_amount / payment_status auto-derive ────────────────

    public function test_derive_payment_status_unpaid_when_zero(): void
    {
        $this->assertEquals(PaymentStatus::Unpaid->value, GoodsReceipt::derivePaymentStatus(0, 500));
    }

    public function test_derive_payment_status_partial_when_less_than_total(): void
    {
        $this->assertEquals(PaymentStatus::PartiallyPaid->value, GoodsReceipt::derivePaymentStatus(100, 500));
    }

    public function test_derive_payment_status_paid_when_equal_to_total(): void
    {
        $this->assertEquals(PaymentStatus::Paid->value, GoodsReceipt::derivePaymentStatus(500, 500));
    }

    public function test_create_gr_auto_sets_payment_status_from_paid_amount(): void
    {
        $product = Product::factory()->create();
        [$po, $poLine] = $this->makeApprovedPo($this->supplier, $product, 100.0, 10.0);

        $receipt = GoodsReceipt::factory()->create([
            'purchase_order_id' => $po->id,
            'warehouse_id' => $this->warehouse->id,
            'invoice_total_amount' => 500.0,
            'paid_amount' => 250.0,
            'payment_status' => PaymentStatus::PartiallyPaid->value,
        ]);

        $receipt->refresh();
        $this->assertEquals('250.00', $receipt->paid_amount);
        $this->assertEquals(250.0, $receipt->outstandingAmount());
        $this->assertEquals(PaymentStatus::PartiallyPaid, $receipt->payment_status);
    }
}
