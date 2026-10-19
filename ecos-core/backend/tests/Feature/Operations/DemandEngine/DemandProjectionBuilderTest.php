<?php

declare(strict_types=1);

namespace Tests\Feature\Operations\DemandEngine;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Operations\DemandAnalysis\Application\Services\DemandCalculationService;
use Modules\Operations\DemandAnalysis\Application\Services\DemandProjectionBuilder;
use Modules\Operations\DemandAnalysis\Application\Services\DemandReadRepository;
use Modules\Operations\DemandAnalysis\Application\Services\MaterialDemandCalculator;
use Modules\Operations\DemandAnalysis\Application\Services\MissingMaterialCalculator;
use Modules\Operations\DemandAnalysis\Application\Services\ProductDemandCalculator;
use Modules\Operations\DemandAnalysis\Application\Services\WaveKpiCalculator;
use Modules\Operations\DemandAnalysis\Domain\Events\ProductDemandUpdated;
use Modules\Operations\DemandAnalysis\Domain\Events\WaveDemandUpdated;
use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Operations\Preparation\Domain\Models\PreparationWaveOrder;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

class DemandProjectionBuilderTest extends TestCase
{
    use RefreshDatabase;

    private Company $company;

    private Warehouse $warehouse;

    private DemandCalculationService $service;

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

        $productCalc = new ProductDemandCalculator;
        $repository = new DemandReadRepository;
        $builder = new DemandProjectionBuilder(
            $productCalc,
            new MaterialDemandCalculator,
            new MissingMaterialCalculator,
            new WaveKpiCalculator,
            $repository,
        );

        $this->service = new DemandCalculationService($builder, $repository);
    }

    // ── Full pipeline ─────────────────────────────────────────────────────────

    public function test_full_recalculation_persists_all_read_models(): void
    {
        Event::fake();

        $wave = $this->makeWave();
        $product = $this->makeProduct('Widget');
        $order = $this->makeOrderWithLine($wave, $product, qty: 10.0);

        $this->service->recalculate($wave, 'test');

        $this->assertDatabaseHas('wave_product_demand', [
            'preparation_wave_id' => $wave->id,
            'product_id' => $product,
        ]);

        $this->assertDatabaseHas('wave_kpis', [
            'preparation_wave_id' => $wave->id,
        ]);
    }

    public function test_full_recalculation_publishes_domain_events(): void
    {
        Event::fake();

        $wave = $this->makeWave();
        $product = $this->makeProduct('Widget');
        $this->makeOrderWithLine($wave, $product, qty: 5.0);

        $this->service->recalculate($wave, 'test');

        Event::assertDispatched(ProductDemandUpdated::class);
        Event::assertDispatched(WaveDemandUpdated::class);
    }

    // ── Incremental pipeline ──────────────────────────────────────────────────

    public function test_incremental_refresh_updates_only_affected_product(): void
    {
        Event::fake();

        $wave = $this->makeWave();
        $productA = $this->makeProduct('Product A');
        $productB = $this->makeProduct('Product B');
        $orderA = $this->makeOrderWithLine($wave, $productA, 5.0);
        $this->makeOrderWithLine($wave, $productB, 20.0);

        // Full build first
        $this->service->recalculate($wave, 'init');

        // Now add more of product A via a second order
        $orderNew = $this->makeOrderWithLine($wave, $productA, 3.0);

        Event::fake(); // reset

        $this->service->recalculateForOrders($wave->fresh(), [$orderNew], 'order_added');

        // Product A row should now reflect 8.0 (5+3), product B unchanged at 20.0
        $productARow = DB::table('wave_product_demand')
            ->where('preparation_wave_id', $wave->id)
            ->where('product_id', $productA)
            ->first();

        $this->assertEquals(8.0, (float) $productARow->required_qty);

        Event::assertDispatched(ProductDemandUpdated::class);
    }

    // ── Idempotency ───────────────────────────────────────────────────────────

    public function test_repeated_full_recalculation_does_not_duplicate_rows(): void
    {
        $wave = $this->makeWave();
        $product = $this->makeProduct('X');
        $this->makeOrderWithLine($wave, $product, 5.0);

        $this->service->recalculate($wave, 'first');
        $this->service->recalculate($wave, 'second');
        $this->service->recalculate($wave, 'third');

        $count = DB::table('wave_product_demand')
            ->where('preparation_wave_id', $wave->id)
            ->where('product_id', $product)
            ->count();

        $this->assertEquals(1, $count);
    }

    public function test_repeated_events_produce_identical_projections(): void
    {
        $wave = $this->makeWave();
        $product = $this->makeProduct('Y');
        $this->makeOrderWithLine($wave, $product, 10.0);

        $this->service->recalculate($wave, 'run1');
        $hash1 = DB::table('wave_product_demand')
            ->where('preparation_wave_id', $wave->id)
            ->value('data_hash');

        $this->service->recalculate($wave, 'run2');
        $hash2 = DB::table('wave_product_demand')
            ->where('preparation_wave_id', $wave->id)
            ->value('data_hash');

        $this->assertSame($hash1, $hash2);
    }

    // ── Multiple waves / warehouses ───────────────────────────────────────────

    public function test_multiple_waves_do_not_cross_contaminate(): void
    {
        $warehouse2 = Warehouse::factory()->create(['company_id' => $this->company->id]);
        $wave1 = $this->makeWave();
        $wave2 = $this->makeWave(warehouseId: $warehouse2->id);

        $product = $this->makeProduct('Shared Product');
        $this->makeOrderWithLine($wave1, $product, 5.0);
        $this->makeOrderWithLine($wave2, $product, 99.0);

        $this->service->recalculate($wave1, 'w1');
        $this->service->recalculate($wave2, 'w2');

        $row1 = DB::table('wave_product_demand')
            ->where('preparation_wave_id', $wave1->id)
            ->first();

        $row2 = DB::table('wave_product_demand')
            ->where('preparation_wave_id', $wave2->id)
            ->first();

        $this->assertEquals(5.0, (float) $row1->required_qty);
        $this->assertEquals(99.0, (float) $row2->required_qty);
    }

    // ── Wave initialization ───────────────────────────────────────────────────

    public function test_initialize_wave_creates_kpi_row_with_zeros(): void
    {
        $wave = $this->makeWave();

        $this->service->initializeWave($wave);

        $kpi = DB::table('wave_kpis')->where('preparation_wave_id', $wave->id)->first();
        $this->assertNotNull($kpi);
        $this->assertEquals(0, $kpi->products_count);
        $this->assertEquals(0.0, (float) $kpi->completion_pct);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeWave(?string $warehouseId = null): PreparationWave
    {
        return PreparationWave::create([
            'company_id' => $this->company->id,
            'warehouse_id' => $warehouseId ?? $this->warehouse->id,
            'wave_number' => 'PREP-PROJ-'.random_int(1, 99999),
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
        $id = (string) Str::uuid();
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

    private function makeOrderWithLine(PreparationWave $wave, string $productId, float $qty): string
    {
        $orderId = (string) Str::uuid();
        DB::table('orders')->insert([
            'id' => $orderId,
            'company_id' => $wave->company_id,
            'assigned_warehouse_id' => $wave->warehouse_id,
            'customer_id' => $this->customerId,
            'order_number' => 'ORD-'.random_int(10000, 99999),
            'status' => 'in_progress',
            'order_date' => today()->toDateString(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('order_lines')->insert([
            'id' => (string) Str::uuid(),
            'order_id' => $orderId,
            'product_id' => $productId,
            'quantity' => $qty,
            'prepared_qty' => 0,
            'unit_price' => 10.0,
            'line_total' => $qty * 10.0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

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

        return $orderId;
    }
}
