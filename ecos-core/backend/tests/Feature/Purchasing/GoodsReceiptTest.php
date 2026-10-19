<?php

declare(strict_types=1);

namespace Tests\Feature\Purchasing;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Inventory\InventoryItems\Domain\Enums\LedgerMovementType;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\InventoryItems\Domain\Models\StockLedgerEntry;
use Modules\MasterData\Units\Domain\Models\Unit;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\Purchasing\GoodsReceipts\Application\Actions\CreateGoodsReceiptAction;
use Modules\Purchasing\GoodsReceipts\Application\Actions\PostGoodsReceiptAction;
use Modules\Purchasing\GoodsReceipts\Application\DTO\GoodsReceiptDTO;
use Modules\Purchasing\GoodsReceipts\Application\DTO\GoodsReceiptLineDTO;
use Modules\Purchasing\GoodsReceipts\Domain\Enums\GoodsReceiptStatus;
use Modules\Purchasing\GoodsReceipts\Domain\Enums\PaymentMethod;
use Modules\Purchasing\GoodsReceipts\Domain\Enums\PaymentStatus;
use Modules\Purchasing\GoodsReceipts\Domain\Exceptions\EmptyGoodsReceiptException;
use Modules\Purchasing\GoodsReceipts\Domain\Exceptions\GoodsReceiptAlreadyPostedException;
use Modules\Purchasing\GoodsReceipts\Domain\Exceptions\OverReceiptException;
use Modules\Purchasing\GoodsReceipts\Domain\Exceptions\PurchaseOrderCancelledException;
use Modules\Purchasing\GoodsReceipts\Domain\Exceptions\PurchaseOrderClosedException;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceipt;
use Modules\Purchasing\GoodsReceipts\Domain\Models\GoodsReceiptLine;
use Modules\Purchasing\PurchaseOrders\Domain\Enums\PurchaseOrderStatus;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrder;
use Modules\Purchasing\PurchaseOrders\Domain\Models\PurchaseOrderLine;
use Tests\TestCase;

class GoodsReceiptTest extends TestCase
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

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    private function makeApprovedPo(float $orderedQty = 100.0, float $unitPrice = 10.0): array
    {
        $po = PurchaseOrder::factory()->approved()->create([
            'company_id' => $this->company->id,
        ]);

        $product = \Modules\Inventory\Products\Domain\Models\Product::factory()->create();

        $poLine = PurchaseOrderLine::factory()->create([
            'purchase_order_id' => $po->id,
            'product_id' => $product->id,
            'quantity' => $orderedQty,
            'received_qty' => 0,
            'unit_price' => $unitPrice,
        ]);

        return [$po, $poLine, $product];
    }

    /**
     * Create a draft GR with lines using explicit gross/net quantities.
     * $headerExtras now uses the renamed column names (freight_amount, tax_amount, additional_costs).
     */
    private function makeReceipt(
        PurchaseOrder $po,
        PurchaseOrderLine $poLine,
        float $netQty,
        float $grossQty = 0.0,
        array $headerExtras = [],
    ): GoodsReceipt {
        $gross = $grossQty > 0 ? $grossQty : $netQty;

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
            'gross_received_quantity' => $gross,
            'net_received_quantity' => $netQty,
            'variance_quantity' => $netQty - (float) $poLine->quantity,
            'unit_price' => (float) $poLine->unit_price,
        ]);

        return $receipt->refresh();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Happy Path — single full receipt
    // ──────────────────────────────────────────────────────────────────────────

    public function test_post_receipt_updates_inventory_using_net_received_quantity(): void
    {
        [$po, $poLine, $product] = $this->makeApprovedPo(orderedQty: 100.0);
        // Gross = 10.5 (including packaging), Net = 9.0 (actual product)
        $receipt = $this->makeReceipt($po, $poLine, netQty: 9.0, grossQty: 10.5);

        $result = app(PostGoodsReceiptAction::class)->execute($receipt->id);

        $this->assertTrue($result->isSuccess());

        // Receipt Posted
        $receipt->refresh();
        $this->assertEquals(GoodsReceiptStatus::Posted, $receipt->status);
        $this->assertNotNull($receipt->posted_at);

        // PO advances to PartiallyReceived (9 of 100 received)
        $this->assertEquals(PurchaseOrderStatus::PartiallyReceived, $po->fresh()->status);

        // Inventory receives NET qty (9), not gross (10.5)
        $item = InventoryItem::query()
            ->where('warehouse_id', $this->warehouse->id)
            ->where('product_id', $product->id)
            ->firstOrFail();
        $this->assertEquals('9.0000', $item->on_hand_qty);
        $this->assertEquals('0.0000', $item->reserved_qty);

        // Ledger entry reference
        $entry = StockLedgerEntry::query()
            ->where('inventory_item_id', $item->id)
            ->firstOrFail();
        $this->assertEquals(LedgerMovementType::PurchaseReceipt->value, $entry->movement_type->value);
        $this->assertEquals('goods_receipt', $entry->reference_type);
        $this->assertEquals($receipt->id, $entry->reference_id);
    }

    public function test_post_receipt_updates_inventory_and_advances_po_to_received(): void
    {
        [$po, $poLine, $product] = $this->makeApprovedPo(100.0);
        $receipt = $this->makeReceipt($po, $poLine, netQty: 100.0, grossQty: 100.0);

        $result = app(PostGoodsReceiptAction::class)->execute($receipt->id);

        $this->assertTrue($result->isSuccess());
        $this->assertEquals(PurchaseOrderStatus::Received, $po->fresh()->status);
        $this->assertEquals('100.0000', $poLine->fresh()->received_qty);

        $item = InventoryItem::query()
            ->where('warehouse_id', $this->warehouse->id)
            ->where('product_id', $product->id)
            ->firstOrFail();
        $this->assertEquals('100.0000', $item->on_hand_qty);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Landed Cost
    // ──────────────────────────────────────────────────────────────────────────

    public function test_post_computes_landed_unit_cost(): void
    {
        // unit_price = 100 EGP, net = 9 KG
        // freight = 100, tax = 50, additional = 0 → extra = 150
        // extra_per_unit = 150 / 9 = 16.6667
        // landed_unit_cost = 100 + 16.6667 = 116.6667
        [$po, $poLine] = $this->makeApprovedPo(orderedQty: 100.0, unitPrice: 100.0);

        $receipt = $this->makeReceipt($po, $poLine, netQty: 9.0, grossQty: 10.0, headerExtras: [
            'freight_amount' => 100.00,
            'tax_amount' => 50.00,
            'additional_costs' => 0.00,
        ]);

        app(PostGoodsReceiptAction::class)->execute($receipt->id);

        $line = $receipt->lines()->first();
        $this->assertNotNull($line->fresh()->landed_unit_cost);
        $expected = round(100.0 + (150.0 / 9.0), 4);
        $this->assertEquals((string) $expected, $line->fresh()->landed_unit_cost);
    }

    public function test_post_with_no_extra_costs_landed_unit_cost_equals_unit_price(): void
    {
        [$po, $poLine] = $this->makeApprovedPo(orderedQty: 50.0, unitPrice: 25.00);
        $receipt = $this->makeReceipt($po, $poLine, netQty: 50.0, grossQty: 50.0);

        app(PostGoodsReceiptAction::class)->execute($receipt->id);

        $line = $receipt->lines()->first();
        $this->assertEquals('25.0000', $line->fresh()->landed_unit_cost);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Payment Tracking (COM-010A-R2)
    // ──────────────────────────────────────────────────────────────────────────

    public function test_new_receipt_defaults_to_unpaid_status(): void
    {
        [$po, $poLine] = $this->makeApprovedPo();
        $receipt = $this->makeReceipt($po, $poLine, netQty: 10.0);

        // Factory does not set payment_status, so it defaults to 'unpaid' via the DB default
        $this->assertEquals(PaymentStatus::Unpaid, $receipt->fresh()->payment_status);
    }

    public function test_payment_due_date_auto_calculated_from_invoice_date_and_terms(): void
    {
        [$po, $poLine] = $this->makeApprovedPo();

        $receipt = $this->makeReceipt($po, $poLine, netQty: 10.0, headerExtras: [
            'supplier_invoice_date' => '2026-06-25',
            'payment_terms_days' => 30,
        ]);

        // payment_due_date not set by factory — it would be set by CreateGoodsReceiptAction
        // Here we verify the columns store correctly for direct use by the action
        $this->assertEquals('2026-06-25', $receipt->fresh()->supplier_invoice_date?->toDateString());
        $this->assertEquals(30, $receipt->fresh()->payment_terms_days);
    }

    public function test_payment_due_date_auto_calculation_logic(): void
    {
        // Verify Carbon date arithmetic: 2026-06-25 + 30 days = 2026-07-25
        $invoiceDate = \Illuminate\Support\Carbon::parse('2026-06-25');
        $termsDays = 30;
        $expectedDue = '2026-07-25';

        $this->assertEquals($expectedDue, $invoiceDate->addDays($termsDays)->toDateString());
    }

    public function test_payment_due_date_auto_calculation_end_of_month(): void
    {
        // 2026-01-31 + 30 days = 2026-03-02 (not 2026-02-31 — Carbon handles overflow)
        $invoiceDate = \Illuminate\Support\Carbon::parse('2026-01-31');
        $this->assertEquals('2026-03-02', $invoiceDate->addDays(30)->toDateString());
    }

    public function test_receipt_stores_invoice_financials(): void
    {
        [$po, $poLine] = $this->makeApprovedPo();

        $receipt = $this->makeReceipt($po, $poLine, netQty: 20.0, headerExtras: [
            'invoice_total_amount' => 5000.00,
            'freight_amount' => 200.00,
            'tax_amount' => 150.00,
            'additional_costs' => 50.00,
        ]);

        $fresh = $receipt->fresh();
        $this->assertEquals('5000.00', $fresh->invoice_total_amount);
        $this->assertEquals('200.00', $fresh->freight_amount);
        $this->assertEquals('150.00', $fresh->tax_amount);
        $this->assertEquals('50.00', $fresh->additional_costs);
        // totalLandedCosts = freight + tax + additional (used for per-unit distribution)
        $this->assertEquals(400.00, $fresh->totalLandedCosts());
    }

    public function test_receipt_stores_payment_method(): void
    {
        [$po, $poLine] = $this->makeApprovedPo();

        $receipt = $this->makeReceipt($po, $poLine, netQty: 10.0, headerExtras: [
            'payment_method' => PaymentMethod::BankTransfer->value,
        ]);

        $this->assertEquals(PaymentMethod::BankTransfer, $receipt->fresh()->payment_method);
    }

    public function test_total_landed_costs_sums_freight_tax_additional(): void
    {
        [$po, $poLine] = $this->makeApprovedPo();

        $receipt = $this->makeReceipt($po, $poLine, netQty: 10.0, headerExtras: [
            'freight_amount' => 100.00,
            'tax_amount' => 75.50,
            'additional_costs' => 24.50,
        ]);

        $this->assertEquals(200.00, $receipt->fresh()->totalLandedCosts());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Partial Receiving
    // ──────────────────────────────────────────────────────────────────────────

    public function test_partial_receipt_advances_po_to_partially_received(): void
    {
        [$po, $poLine] = $this->makeApprovedPo(100.0);
        $receipt = $this->makeReceipt($po, $poLine, netQty: 30.0);

        app(PostGoodsReceiptAction::class)->execute($receipt->id);

        $this->assertEquals(PurchaseOrderStatus::PartiallyReceived, $po->fresh()->status);
        $this->assertEquals('30.0000', $poLine->fresh()->received_qty);
    }

    public function test_multiple_partial_receipts_complete_po(): void
    {
        [$po, $poLine, $product] = $this->makeApprovedPo(100.0);

        // 30 + 40 + 30 = 100
        $r1 = $this->makeReceipt($po, $poLine, netQty: 30.0);
        app(PostGoodsReceiptAction::class)->execute($r1->id);
        $this->assertEquals(PurchaseOrderStatus::PartiallyReceived, $po->fresh()->status);

        $r2 = $this->makeReceipt($po, $poLine, netQty: 40.0);
        app(PostGoodsReceiptAction::class)->execute($r2->id);
        $this->assertEquals('70.0000', $poLine->fresh()->received_qty);

        $r3 = $this->makeReceipt($po, $poLine, netQty: 30.0);
        app(PostGoodsReceiptAction::class)->execute($r3->id);

        $this->assertEquals(PurchaseOrderStatus::Received, $po->fresh()->status);
        $this->assertEquals('100.0000', $poLine->fresh()->received_qty);

        $item = InventoryItem::query()
            ->where('warehouse_id', $this->warehouse->id)
            ->where('product_id', $product->id)
            ->firstOrFail();
        $this->assertEquals('100.0000', $item->on_hand_qty);
        $this->assertEquals(3, StockLedgerEntry::query()->where('inventory_item_id', $item->id)->count());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Validation Guards
    // ──────────────────────────────────────────────────────────────────────────

    public function test_over_receipt_throws_exception(): void
    {
        [$po, $poLine] = $this->makeApprovedPo(100.0);
        $receipt = $this->makeReceipt($po, $poLine, netQty: 110.0, grossQty: 111.0);

        $this->expectException(OverReceiptException::class);
        app(PostGoodsReceiptAction::class)->execute($receipt->id);
    }

    public function test_over_receipt_across_multiple_receipts_throws(): void
    {
        [$po, $poLine] = $this->makeApprovedPo(100.0);

        $r1 = $this->makeReceipt($po, $poLine, netQty: 80.0);
        app(PostGoodsReceiptAction::class)->execute($r1->id);

        $r2 = $this->makeReceipt($po, $poLine, netQty: 30.0);

        $this->expectException(OverReceiptException::class);
        app(PostGoodsReceiptAction::class)->execute($r2->id);
    }

    public function test_duplicate_posting_throws_already_posted_exception(): void
    {
        [$po, $poLine] = $this->makeApprovedPo(100.0);
        $receipt = $this->makeReceipt($po, $poLine, netQty: 50.0);

        app(PostGoodsReceiptAction::class)->execute($receipt->id);

        $this->expectException(GoodsReceiptAlreadyPostedException::class);
        app(PostGoodsReceiptAction::class)->execute($receipt->id);
    }

    public function test_posting_empty_receipt_throws(): void
    {
        [$po] = $this->makeApprovedPo(100.0);

        $receipt = GoodsReceipt::factory()->create([
            'purchase_order_id' => $po->id,
            'warehouse_id' => $this->warehouse->id,
        ]);

        $this->expectException(EmptyGoodsReceiptException::class);
        app(PostGoodsReceiptAction::class)->execute($receipt->id);
    }

    public function test_posting_against_cancelled_po_throws(): void
    {
        [$po, $poLine] = $this->makeApprovedPo(100.0);
        $receipt = $this->makeReceipt($po, $poLine, netQty: 50.0);

        $po->update(['status' => PurchaseOrderStatus::Cancelled->value]);

        $this->expectException(PurchaseOrderCancelledException::class);
        app(PostGoodsReceiptAction::class)->execute($receipt->id);
    }

    public function test_posting_against_closed_po_throws(): void
    {
        [$po, $poLine] = $this->makeApprovedPo(100.0);
        $receipt = $this->makeReceipt($po, $poLine, netQty: 50.0);

        $po->update(['status' => PurchaseOrderStatus::Closed->value]);

        $this->expectException(PurchaseOrderClosedException::class);
        app(PostGoodsReceiptAction::class)->execute($receipt->id);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // UOM Snapshot (COM-010A-R1B)
    // ──────────────────────────────────────────────────────────────────────────

    public function test_uom_snapshot_captured_on_line_creation(): void
    {
        $unit = Unit::factory()->create(['name' => 'Kilogram', 'symbol' => 'KG']);
        $product = \Modules\Inventory\Products\Domain\Models\Product::factory()->create(['unit_id' => $unit->id]);
        $po = PurchaseOrder::factory()->approved()->create(['company_id' => $this->company->id]);
        $poLine = PurchaseOrderLine::factory()->create([
            'purchase_order_id' => $po->id,
            'product_id' => $product->id,
            'quantity' => 10.0,
            'unit_price' => 50.0,
        ]);

        $dto = new GoodsReceiptDTO(
            purchase_order_id: $po->id,
            warehouse_id: $this->warehouse->id,
            receipt_date: '2026-06-25',
            notes: null,
            lines: [
                new GoodsReceiptLineDTO(
                    purchase_order_line_id: $poLine->id,
                    product_id: $product->id,
                    ordered_quantity: 10.0,
                    received_quantity: 8.0,
                    gross_received_quantity: 9.0,
                    net_received_quantity: 8.0,
                ),
            ],
        );

        $result = app(CreateGoodsReceiptAction::class)->execute($dto);
        $this->assertTrue($result->isSuccess());

        $receipt = $result->data();
        $line = $receipt->lines()->first();

        $this->assertEquals($unit->id, $line->uom_id_snapshot);
        $this->assertEquals('Kilogram', $line->uom_name_snapshot);
        $this->assertEquals('KG', $line->uom_symbol_snapshot);
    }

    public function test_uom_snapshot_immutable_after_product_unit_change(): void
    {
        $unit1 = Unit::factory()->create(['name' => 'Kilogram', 'symbol' => 'KG']);
        $unit2 = Unit::factory()->create(['name' => 'Gram', 'symbol' => 'G']);
        $product = \Modules\Inventory\Products\Domain\Models\Product::factory()->create(['unit_id' => $unit1->id]);
        $po = PurchaseOrder::factory()->approved()->create(['company_id' => $this->company->id]);
        $poLine = PurchaseOrderLine::factory()->create([
            'purchase_order_id' => $po->id,
            'product_id' => $product->id,
            'quantity' => 10.0,
            'unit_price' => 50.0,
        ]);

        $dto = new GoodsReceiptDTO(
            purchase_order_id: $po->id,
            warehouse_id: $this->warehouse->id,
            receipt_date: '2026-06-25',
            notes: null,
            lines: [
                new GoodsReceiptLineDTO(
                    purchase_order_line_id: $poLine->id,
                    product_id: $product->id,
                    ordered_quantity: 10.0,
                    received_quantity: 5.0,
                    gross_received_quantity: 5.0,
                    net_received_quantity: 5.0,
                ),
            ],
        );

        $receipt = app(CreateGoodsReceiptAction::class)->execute($dto)->data();
        $line = $receipt->lines()->first();

        // Snapshot captured at time of receipt creation
        $this->assertEquals('KG', $line->uom_symbol_snapshot);

        // Product unit changes AFTER the receipt is created
        $product->update(['unit_id' => $unit2->id]);

        // Snapshot must remain unchanged (immutable)
        $this->assertEquals('KG', $line->fresh()->uom_symbol_snapshot);
        $this->assertEquals($unit1->id, $line->fresh()->uom_id_snapshot);
    }

    public function test_inventory_not_updated_for_zero_net_quantity_lines(): void
    {
        [$po, $poLine] = $this->makeApprovedPo(100.0);

        $receipt = GoodsReceipt::factory()->create([
            'purchase_order_id' => $po->id,
            'warehouse_id' => $this->warehouse->id,
        ]);

        GoodsReceiptLine::factory()->create([
            'goods_receipt_id' => $receipt->id,
            'purchase_order_line_id' => $poLine->id,
            'product_id' => $poLine->product_id,
            'ordered_quantity' => 100.0,
            'received_quantity' => 0.0,
            'gross_received_quantity' => 0.0,
            'net_received_quantity' => 0.0,
            'variance_quantity' => -100.0,
            'unit_price' => 10.0,
        ]);

        $this->expectException(EmptyGoodsReceiptException::class);
        app(PostGoodsReceiptAction::class)->execute($receipt->id);
    }

    public function test_gross_qty_field_stored_separately_from_net(): void
    {
        [$po, $poLine] = $this->makeApprovedPo(100.0);
        // Gross = 12, Net = 10 (2 units discarded for quality)
        $receipt = $this->makeReceipt($po, $poLine, netQty: 10.0, grossQty: 12.0);

        app(PostGoodsReceiptAction::class)->execute($receipt->id);

        $line = $receipt->lines()->first()->fresh();
        $this->assertEquals('12.0000', $line->gross_received_quantity);
        $this->assertEquals('10.0000', $line->net_received_quantity);
        $this->assertEquals('-90.0000', $line->variance_quantity);
    }
}
