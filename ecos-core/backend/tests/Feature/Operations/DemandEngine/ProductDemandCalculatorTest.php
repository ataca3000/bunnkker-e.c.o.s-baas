<?php

declare(strict_types=1);

namespace Tests\Feature\Operations\DemandEngine;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Operations\DemandAnalysis\Application\Services\ProductDemandCalculator;
use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Operations\Preparation\Domain\Models\PreparationWaveOrder;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

class ProductDemandCalculatorTest extends TestCase
{
    use RefreshDatabase;

    private Company $company;

    private Warehouse $warehouse;

    private ProductDemandCalculator $calculator;

    private string $categoryId;

    private string $unitId;

    private string $customerId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);

        // products.category_id and products.unit_id are NOT NULL. makeProduct()
        // inserts raw, so no model or factory default applies.
        $this->categoryId = (string) \Modules\MasterData\Categories\Domain\Models\Category::factory()->create()->id;
        $this->unitId = (string) \Modules\MasterData\Units\Domain\Models\Unit::factory()->create()->id;

        // orders.customer_id carries a foreign key to customers; makeOrder()
        // previously inserted a random UUID, which cannot satisfy it.
        $this->customerId = (string) \Modules\Sales\Customers\Domain\Models\Customer::factory()->create()->id;

        $this->calculator = new ProductDemandCalculator;
    }

    // ── Product aggregation ───────────────────────────────────────────────────

    public function test_aggregates_order_lines_by_product(): void
    {
        $wave = $this->makeWave();
        $productA = $this->makeProduct('Product A');
        $productB = $this->makeProduct('Product B');

        $order1 = $this->makeOrder();
        $order2 = $this->makeOrder();
        $this->attachOrderToWave($wave, $order1);
        $this->attachOrderToWave($wave, $order2);

        $this->makeOrderLine($order1, $productA, 5.0);
        $this->makeOrderLine($order2, $productA, 3.0);
        $this->makeOrderLine($order1, $productB, 2.0);

        $rows = $this->calculator->calculate($wave);

        $byProduct = collect($rows)->keyBy('product_id');
        $this->assertArrayHasKey($productA, $byProduct);
        $this->assertArrayHasKey($productB, $byProduct);

        $this->assertEquals(8.0, $byProduct[$productA]['required_qty']);
        $this->assertEquals(2, $byProduct[$productA]['orders_count']);
        $this->assertEquals(2.0, $byProduct[$productB]['required_qty']);
        $this->assertEquals(1, $byProduct[$productB]['orders_count']);
    }

    public function test_calculates_completion_percentage(): void
    {
        $wave = $this->makeWave();
        $product = $this->makeProduct('Finished Good');
        $order = $this->makeOrder();
        $this->attachOrderToWave($wave, $order);

        $this->makeOrderLine($order, $product, 10.0, preparedQty: 4.0);

        $rows = $this->calculator->calculate($wave);
        $row = collect($rows)->firstWhere('product_id', $product);

        $this->assertEquals(10.0, $row['required_qty']);
        $this->assertEquals(4.0, $row['prepared_qty']);
        $this->assertEquals(6.0, $row['remaining_qty']);
        $this->assertEquals(40.0, $row['completion_pct']);
    }

    public function test_remaining_qty_is_never_negative(): void
    {
        $wave = $this->makeWave();
        $product = $this->makeProduct('Over-Prepared Product');
        $order = $this->makeOrder();
        $this->attachOrderToWave($wave, $order);

        // Prepared > required (edge case from manual override)
        $this->makeOrderLine($order, $product, 5.0, preparedQty: 8.0);

        $rows = $this->calculator->calculate($wave);
        $row = collect($rows)->firstWhere('product_id', $product);

        $this->assertEquals(0.0, $row['remaining_qty']);
    }

    public function test_empty_wave_returns_no_rows(): void
    {
        $wave = $this->makeWave();

        $rows = $this->calculator->calculate($wave);

        $this->assertEmpty($rows);
    }

    // ── Incremental refresh ───────────────────────────────────────────────────

    public function test_incremental_only_recalculates_affected_products(): void
    {
        $wave = $this->makeWave();
        $productA = $this->makeProduct('A');
        $productB = $this->makeProduct('B');
        $order1 = $this->makeOrder();
        $order2 = $this->makeOrder();
        $this->attachOrderToWave($wave, $order1);
        $this->attachOrderToWave($wave, $order2);

        $this->makeOrderLine($order1, $productA, 10.0);
        $this->makeOrderLine($order2, $productB, 7.0);

        // Only recalculate product A
        $rows = $this->calculator->calculate($wave, [$productA]);

        $this->assertCount(1, $rows);
        $this->assertEquals($productA, $rows[0]['product_id']);
        $this->assertEquals(10.0, $rows[0]['required_qty']);
    }

    // ── Multiple warehouses isolation ─────────────────────────────────────────

    public function test_orders_from_different_waves_do_not_cross_contaminate(): void
    {
        $warehouse2 = Warehouse::factory()->create(['company_id' => $this->company->id]);
        $wave1 = $this->makeWave();
        $wave2 = $this->makeWave(warehouseId: $warehouse2->id);

        $product = $this->makeProduct('Shared Product');
        $order1 = $this->makeOrder();
        $order2 = $this->makeOrder();
        $this->attachOrderToWave($wave1, $order1);
        $this->attachOrderToWave($wave2, $order2);

        $this->makeOrderLine($order1, $product, 5.0);
        $this->makeOrderLine($order2, $product, 20.0);

        $rows1 = $this->calculator->calculate($wave1);
        $rows2 = $this->calculator->calculate($wave2);

        $this->assertEquals(5.0, $rows1[0]['required_qty']);
        $this->assertEquals(20.0, $rows2[0]['required_qty']);
    }

    // ── productIdsForOrders helper ────────────────────────────────────────────

    public function test_product_ids_for_orders_returns_unique_product_ids(): void
    {
        $order = $this->makeOrder();
        $product = $this->makeProduct('P');
        $this->makeOrderLine($order, $product, 1.0);
        $this->makeOrderLine($order, $product, 2.0); // duplicate product in same order

        $ids = $this->calculator->productIdsForOrders([$order]);

        $this->assertCount(1, $ids);
        $this->assertContains($product, $ids);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeWave(?string $warehouseId = null): PreparationWave
    {
        return PreparationWave::create([
            'company_id' => $this->company->id,
            'warehouse_id' => $warehouseId ?? $this->warehouse->id,
            'wave_number' => 'PREP-TEST-'.random_int(1, 99999),
            'planning_date' => today()->toDateString(),
            'status' => WaveStatus::Collecting->value,
            'orders_count' => 0,
            'products_count' => 0,
            'lines_count' => 0,
            'total_units_required' => 0,
            'total_units_prepared' => 0,
            'shortage_detected' => false,
            'wave_type' => 'engine',
            'created_by' => 'test',
            'updated_by' => 'test',
        ]);
    }

    private function makeProduct(string $name): string
    {
        $id = (string) \Illuminate\Support\Str::uuid();
        DB::table('products')->insert([
            'id' => $id,
            // Raw insert bypasses the model and factory, so products.company_id
            // (NOT NULL) must be supplied explicitly.
            'company_id' => $this->company->id,
            'category_id' => $this->categoryId,
            'unit_id' => $this->unitId,
            'name' => $name,
            'sku' => 'SKU-'.random_int(1000, 9999),
            'product_type' => 'finished_good',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $id;
    }

    private function makeOrder(): string
    {
        $id = (string) \Illuminate\Support\Str::uuid();
        DB::table('orders')->insert([
            'id' => $id,
            'company_id' => $this->company->id,
            'assigned_warehouse_id' => $this->warehouse->id,
            'customer_id' => $this->customerId,
            'order_number' => 'ORD-'.random_int(10000, 99999),
            'status' => 'in_progress',
            'order_date' => today()->toDateString(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $id;
    }

    private function attachOrderToWave(PreparationWave $wave, string $orderId): void
    {
        PreparationWaveOrder::create([
            'company_id' => $wave->company_id,
            'preparation_wave_id' => $wave->id,
            'order_id' => $orderId,
            'order_number' => 'ORD-'.random_int(10000, 99999),
            'order_confirmed_at' => now(),
            'is_paid' => false,
            'preparation_priority' => 5,
            'added_at' => now(),
            'added_by' => 'test',
        ]);
    }

    private function makeOrderLine(string $orderId, string $productId, float $qty, float $preparedQty = 0.0): void
    {
        DB::table('order_lines')->insert([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'order_id' => $orderId,
            'product_id' => $productId,
            'quantity' => $qty,
            'prepared_qty' => $preparedQty,
            'unit_price' => 10.0,
            'line_total' => $qty * 10.0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
