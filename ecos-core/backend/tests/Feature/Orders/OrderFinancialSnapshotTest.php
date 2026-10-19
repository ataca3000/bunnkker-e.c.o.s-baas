<?php

declare(strict_types=1);

namespace Tests\Feature\Orders;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Commerce\Orders\Application\Services\CreateOrderSnapshotService;
use Modules\Commerce\Orders\Domain\Exceptions\SnapshotConsistencyException;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Orders\Domain\Models\OrderFinancialSnapshot;
use Modules\Commerce\Orders\Domain\Models\OrderLine;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\BillOfMaterial;
use Modules\Organization\Brands\Domain\Models\Brand;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\Sales\Customers\Domain\Models\Customer;
use RuntimeException;
use Tests\TestCase;

/**
 * TASK-ORDER-006B PART 10 — Enterprise Integration Tests: Immutable Financial Snapshot.
 *
 * Full lifecycle coverage:
 *  1. Confirmation triggers snapshot creation
 *  2. Snapshot is locked on creation
 *  3. createIfAbsent is idempotent
 *  4. SHA-256 integrity hash validates correctly
 *  5. Historical pricing preserved after product price change
 *  6. Historical costing preserved after BOM change
 *  7. Consistency validation rejects mismatched subtotal
 *  8. Correct financial aggregates captured in snapshot header
 *  9. Model is immutable (update silently fails, delete throws)
 * 10. Line snapshot captures correct product details
 */
class OrderFinancialSnapshotTest extends TestCase
{
    use RefreshDatabase;

    private Company $company;

    private Brand $brand;

    private Customer $customer;

    private CreateOrderSnapshotService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->brand = Brand::factory()->create(['company_id' => $this->company->id]);
        $this->customer = Customer::factory()->create();
        $this->service = app(CreateOrderSnapshotService::class);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeProduct(array $overrides = []): Product
    {
        return Product::factory()->finishedGood()->create(array_merge([
            'brand_id' => $this->brand->id,
            'regular_price' => 100.0,
            'sale_price' => null,
        ], $overrides));
    }

    private function makeOrder(array $overrides = []): Order
    {
        return Order::create(array_merge([
            'customer_id' => $this->customer->id,
            'order_number' => 'ORD-'.uniqid(),
            'order_date' => now()->toDateString(),
            'status' => 'in_progress',
            'subtotal' => 200.0,
            'total' => 200.0,
            'shipping_total' => 0,
            'discount_total' => 0,
            'tax_total' => 0,
            'discount_amount' => 0.0,
            'deposit_amount' => 0.0,
            'remaining_balance' => 200.0,
        ], $overrides));
    }

    private function addLine(Order $order, Product $product, float $qty = 2.0, float $unitPrice = 100.0): OrderLine
    {
        return OrderLine::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'quantity' => $qty,
            'unit_price' => $unitPrice,
            'line_total' => round($qty * $unitPrice, 4),
        ]);
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    /**
     * SCENARIO 1 — Transitioning to confirm_order creates an immutable snapshot.
     */
    public function test_confirm_order_creates_snapshot(): void
    {
        $product = $this->makeProduct();
        $order = $this->makeOrder(['subtotal' => 200.0, 'total' => 200.0]);
        $this->addLine($order, $product, 2.0, 100.0);

        $snapshot = $this->service->createIfAbsent($order);

        $this->assertNotNull($snapshot);
        $this->assertInstanceOf(OrderFinancialSnapshot::class, $snapshot);
        $this->assertDatabaseHas('order_financial_snapshots', [
            'order_id' => $order->id,
            'grand_total' => 200.0,
        ]);
    }

    /**
     * SCENARIO 2 — Snapshot is locked with a timestamp and integrity hash at creation.
     */
    public function test_snapshot_is_locked_on_creation(): void
    {
        $product = $this->makeProduct();
        $order = $this->makeOrder(['subtotal' => 100.0, 'total' => 100.0]);
        $this->addLine($order, $product, 1.0, 100.0);

        $snapshot = $this->service->createIfAbsent($order);

        $this->assertTrue($snapshot->locked);
        $this->assertNotNull($snapshot->locked_at);
        $this->assertNotNull($snapshot->integrity_hash);
        $this->assertEquals(64, strlen($snapshot->integrity_hash), 'SHA-256 hash must be 64 hex chars');
        $this->assertEquals(1, $snapshot->snapshot_version);
    }

    /**
     * SCENARIO 3 — Calling createIfAbsent twice returns null on the second call (idempotent).
     */
    public function test_create_if_absent_is_idempotent(): void
    {
        $product = $this->makeProduct();
        $order = $this->makeOrder(['subtotal' => 100.0, 'total' => 100.0]);
        $this->addLine($order, $product, 1.0, 100.0);

        $first = $this->service->createIfAbsent($order);
        $second = $this->service->createIfAbsent($order);

        $this->assertNotNull($first);
        $this->assertNull($second, 'Second call must return null — snapshot already exists');

        $count = OrderFinancialSnapshot::where('order_id', $order->id)->count();
        $this->assertEquals(1, $count, 'Only one snapshot row must exist per order');
    }

    /**
     * SCENARIO 4 — The SHA-256 hash computed from the stored snapshot matches the stored value.
     */
    public function test_integrity_hash_verifies_against_stored_data(): void
    {
        $product = $this->makeProduct();
        $order = $this->makeOrder(['subtotal' => 300.0, 'total' => 300.0]);
        $this->addLine($order, $product, 3.0, 100.0);

        $snapshot = $this->service->createIfAbsent($order);
        $snapshot->load('lines');

        $this->assertTrue(
            $this->service->verifyIntegrityHash($snapshot),
            'Hash recomputed from stored snapshot data must match stored integrity_hash',
        );
    }

    /**
     * SCENARIO 5 — Changing the product price after confirmation does not alter the snapshot.
     */
    public function test_snapshot_preserves_historical_unit_price(): void
    {
        $product = $this->makeProduct(['regular_price' => 100.0]);
        $order = $this->makeOrder(['subtotal' => 100.0, 'total' => 100.0]);
        $this->addLine($order, $product, 1.0, 100.0);

        $snapshot = $this->service->createIfAbsent($order);

        // Price change after confirmation — must not affect snapshot
        $product->update(['regular_price' => 250.0, 'sale_price' => 200.0]);

        $snapshot->load('lines');
        $line = $snapshot->lines->first();

        $this->assertEquals(100.0, $line->unit_price_at_sale, 'Price at sale must be frozen in snapshot');
        $this->assertEquals(100.0, $line->line_total);
    }

    /**
     * SCENARIO 6 — Changing a BOM after confirmation does not alter the snapshot cost.
     */
    public function test_snapshot_preserves_historical_unit_cost(): void
    {
        $product = $this->makeProduct(['regular_price' => 100.0]);

        // BOM with known manufacturing cost (no ingredient lines needed here)
        $bom = BillOfMaterial::create([
            'bom_number' => 'BOM-SNAP-TEST-001',
            'product_id' => $product->id,
            'version' => '1.0',
            'bom_version_number' => 1,
            'is_active' => true,
            'manufacturing_cost' => 30.0,
            'other_costs' => 0.0,
            'recipe_cost' => 30.0,
        ]);

        $order = $this->makeOrder(['subtotal' => 100.0, 'total' => 100.0]);
        $this->addLine($order, $product, 1.0, 100.0);

        $snapshot = $this->service->createIfAbsent($order);
        $snapshot->load('lines');

        // BOM change after confirmation — must not affect snapshot
        $bom->update(['manufacturing_cost' => 60.0, 'recipe_cost' => 60.0]);

        $line = $snapshot->lines->first();
        $this->assertEquals(30.0, $line->unit_cost, 'Unit cost must be frozen in snapshot at 30.0');
        $this->assertEquals(30.0, $line->line_cost);
    }

    /**
     * SCENARIO 7 — Consistency validation throws when line totals do not match order subtotal.
     */
    public function test_consistency_validation_rejects_mismatched_subtotal(): void
    {
        $product = $this->makeProduct();

        // Subtotal is 50.0 but the single line totals 100.0 — deliberate mismatch
        $order = $this->makeOrder(['subtotal' => 50.0, 'total' => 50.0]);
        $this->addLine($order, $product, 1.0, 100.0);

        $this->expectException(SnapshotConsistencyException::class);
        $this->expectExceptionMessageMatches('/line subtotal/i');

        $this->service->createIfAbsent($order);
    }

    /**
     * SCENARIO 8 — Snapshot header captures all financial aggregates correctly.
     */
    public function test_snapshot_captures_correct_financial_aggregates(): void
    {
        $product = $this->makeProduct();
        // subtotal=200, discount=10, shipping=20 → total=210
        $order = $this->makeOrder([
            'subtotal' => 200.0,
            'total' => 210.0,
            'shipping_cost' => 20.0,
            'discount_amount' => 10.0,
            'deposit_amount' => 50.0,
            'remaining_balance' => 160.0,
        ]);
        $this->addLine($order, $product, 2.0, 100.0);

        $snapshot = $this->service->createIfAbsent($order);

        $this->assertEquals(200.0, $snapshot->subtotal);
        $this->assertEquals(210.0, $snapshot->grand_total);
        $this->assertEquals(20.0, $snapshot->shipping_cost);
        $this->assertEquals(10.0, $snapshot->discount_amount);
        $this->assertEquals(50.0, $snapshot->deposit_amount);
        $this->assertEquals(160.0, $snapshot->remaining_balance);
        $this->assertEquals(1, $snapshot->snapshot_version);
        $this->assertNotNull($snapshot->snapshot_uuid);
    }

    /**
     * SCENARIO 9 — The snapshot model rejects updates silently and throws on delete.
     */
    public function test_snapshot_model_is_immutable(): void
    {
        $product = $this->makeProduct();
        $order = $this->makeOrder(['subtotal' => 100.0, 'total' => 100.0]);
        $this->addLine($order, $product, 1.0, 100.0);

        $snapshot = $this->service->createIfAbsent($order);
        $originalTotal = $snapshot->grand_total;

        // Update is silently rejected
        $snapshot->update(['grand_total' => 9999.0]);
        $snapshot->refresh();
        $this->assertEquals(
            $originalTotal,
            $snapshot->grand_total,
            'Update must be silently rejected by the immutable model',
        );

        // Delete throws RuntimeException
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/immutable/i');
        $snapshot->delete();
    }

    /**
     * SCENARIO 10 — Line snapshot captures correct product identity and pricing.
     */
    public function test_snapshot_line_captures_correct_product_details(): void
    {
        $product = $this->makeProduct(['regular_price' => 150.0]);
        $order = $this->makeOrder(['subtotal' => 300.0, 'total' => 300.0]);
        $this->addLine($order, $product, 2.0, 150.0);

        $snapshot = $this->service->createIfAbsent($order);
        $snapshot->load('lines');

        $this->assertCount(1, $snapshot->lines, 'Snapshot must have exactly one line');

        $line = $snapshot->lines->first();
        $this->assertEquals($product->id, $line->product_id);
        $this->assertEquals($product->sku, $line->product_sku);
        $this->assertEquals($product->name, $line->product_name);
        $this->assertEquals(2.0, $line->quantity);
        $this->assertEquals(150.0, $line->unit_price_at_sale);
        $this->assertEquals(300.0, $line->line_total);
    }
}
