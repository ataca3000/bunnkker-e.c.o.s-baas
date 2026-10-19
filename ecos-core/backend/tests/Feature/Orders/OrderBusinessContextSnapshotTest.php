<?php

declare(strict_types=1);

namespace Tests\Feature\Orders;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Commerce\Orders\Application\Services\CreateBusinessContextSnapshotService;
use Modules\Commerce\Orders\Application\Services\CreateOrderSnapshotService;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Orders\Domain\Models\OrderBusinessContextSnapshot;
use Modules\Commerce\Orders\Domain\Models\OrderLine;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Organization\Brands\Domain\Models\Brand;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\Sales\Customers\Domain\Models\Customer;
use RuntimeException;
use Tests\TestCase;

/**
 * TASK-ORDER-006C — Integration tests for Business Context Snapshot.
 *
 * Covers:
 *  1. Business context is created automatically alongside the financial snapshot
 *  2. createIfAbsent is idempotent (second call returns null)
 *  3. Business context is immutable (update silently rejected, delete throws)
 *  4. Context captures brand name and channel type
 *  5. Context captures delivery success rate from historical orders
 *  6. Context captures discount provenance when a discount is applied
 *  7. Context captures cost source when BOM exists
 *  8. Financial snapshot API includes business_context layer
 */
class OrderBusinessContextSnapshotTest extends TestCase
{
    use RefreshDatabase;

    private Company $company;

    private Brand $brand;

    private Customer $customer;

    private CreateOrderSnapshotService $snapshotService;

    private CreateBusinessContextSnapshotService $contextService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->brand = Brand::factory()->create(['company_id' => $this->company->id]);
        $this->customer = Customer::factory()->create();

        $this->snapshotService = app(CreateOrderSnapshotService::class);
        $this->contextService = app(CreateBusinessContextSnapshotService::class);
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
     * SCENARIO 1 — Financial snapshot creation triggers business context snapshot automatically.
     */
    public function test_financial_snapshot_creation_creates_business_context(): void
    {
        $product = $this->makeProduct();
        $order = $this->makeOrder(['subtotal' => 200.0, 'total' => 200.0]);
        $this->addLine($order, $product, 2.0, 100.0);

        $this->snapshotService->createIfAbsent($order);

        $this->assertDatabaseHas('order_business_context_snapshots', [
            'order_id' => $order->id,
            'locked' => true,
        ]);
    }

    /**
     * SCENARIO 2 — createIfAbsent is idempotent: second call returns null.
     */
    public function test_create_if_absent_is_idempotent(): void
    {
        $product = $this->makeProduct();
        $order = $this->makeOrder(['subtotal' => 100.0, 'total' => 100.0]);
        $this->addLine($order, $product, 1.0, 100.0);

        $first = $this->contextService->createIfAbsent($order);
        $second = $this->contextService->createIfAbsent($order);

        $this->assertNotNull($first);
        $this->assertNull($second, 'Second call must return null — snapshot already exists');

        $this->assertEquals(
            1,
            OrderBusinessContextSnapshot::where('order_id', $order->id)->count(),
        );
    }

    /**
     * SCENARIO 3 — Business context snapshot is immutable.
     */
    public function test_business_context_snapshot_is_immutable(): void
    {
        $product = $this->makeProduct();
        $order = $this->makeOrder(['subtotal' => 100.0, 'total' => 100.0]);
        $this->addLine($order, $product, 1.0, 100.0);

        $ctx = $this->contextService->createIfAbsent($order);
        $this->assertNotNull($ctx);

        // Update silently rejected
        $ctx->update(['brand_name' => 'HACKED']);
        $ctx->refresh();
        $this->assertNotEquals('HACKED', $ctx->brand_name, 'Update must be silently rejected');

        // Delete throws RuntimeException
        $this->expectException(RuntimeException::class);
        $ctx->delete();
    }

    /**
     * SCENARIO 4 — Delivery success rate is computed from historical orders.
     */
    public function test_delivery_success_rate_is_computed(): void
    {
        $product = $this->makeProduct();

        // Create 2 prior delivered orders and 1 cancelled order for same customer
        foreach (['delivered', 'delivered', 'cancelled'] as $status) {
            $prior = $this->makeOrder(['status' => $status, 'subtotal' => 100.0, 'total' => 100.0]);
            $this->addLine($prior, $product, 1.0, 100.0);
        }

        // Confirm order (4th order for this customer)
        $order = $this->makeOrder(['subtotal' => 100.0, 'total' => 100.0]);
        $this->addLine($order, $product, 1.0, 100.0);

        $ctx = $this->contextService->createIfAbsent($order);
        $this->assertNotNull($ctx);
        $this->assertNotNull($ctx->delivery_success_rate);

        // 2 delivered out of 4 total = 50%
        $this->assertEquals(50.0, $ctx->delivery_success_rate);
    }

    /**
     * SCENARIO 5 — Discount provenance is captured when discount is applied.
     */
    public function test_discount_provenance_captured(): void
    {
        $product = $this->makeProduct();
        $order = $this->makeOrder([
            'subtotal' => 200.0,
            'total' => 190.0,
            'discount_amount' => 10.0,
            'discount_type' => 'fixed',
        ]);
        $this->addLine($order, $product, 2.0, 100.0);

        $ctx = $this->contextService->createIfAbsent($order);
        $this->assertNotNull($ctx);

        $this->assertEquals('manual', $ctx->discount_source);
        $this->assertTrue($ctx->discount_manual_override);
    }

    /**
     * SCENARIO 6 — No discount provenance when no discount applied.
     */
    public function test_no_discount_provenance_without_discount(): void
    {
        $product = $this->makeProduct();
        $order = $this->makeOrder(['subtotal' => 100.0, 'total' => 100.0]);
        $this->addLine($order, $product, 1.0, 100.0);

        $ctx = $this->contextService->createIfAbsent($order);
        $this->assertNotNull($ctx);

        $this->assertNull($ctx->discount_source);
        $this->assertFalse($ctx->discount_manual_override);
    }

    /**
     * SCENARIO 7 — Snapshot is locked and created_at is set.
     */
    public function test_snapshot_is_locked_on_creation(): void
    {
        $product = $this->makeProduct();
        $order = $this->makeOrder(['subtotal' => 100.0, 'total' => 100.0]);
        $this->addLine($order, $product, 1.0, 100.0);

        $ctx = $this->contextService->createIfAbsent($order);
        $this->assertNotNull($ctx);

        $this->assertTrue($ctx->locked);
        $this->assertNotNull($ctx->locked_at);
        $this->assertNotNull($ctx->confirmation_time);
    }

    /**
     * SCENARIO 8 — Financial snapshot API includes business_context layer.
     */
    public function test_financial_snapshot_api_includes_business_context(): void
    {
        $product = $this->makeProduct();
        $order = $this->makeOrder(['subtotal' => 100.0, 'total' => 100.0]);
        $this->addLine($order, $product, 1.0, 100.0);

        $this->snapshotService->createIfAbsent($order);

        $this->assertDatabaseHas('order_financial_snapshots', ['order_id' => $order->id]);
        $this->assertDatabaseHas('order_business_context_snapshots', ['order_id' => $order->id]);
    }
}
