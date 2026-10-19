<?php

declare(strict_types=1);

namespace Tests\Feature\Operations\DemandEngine;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Operations\DemandAnalysis\Application\Services\WaveKpiCalculator;
use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

class WaveKpiCalculatorTest extends TestCase
{
    use RefreshDatabase;

    private Company $company;

    private Warehouse $warehouse;

    private WaveKpiCalculator $calculator;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);
        $this->calculator = new WaveKpiCalculator;
    }

    public function test_kpis_are_zero_for_empty_wave(): void
    {
        $wave = $this->makeWave();

        $kpi = $this->calculator->calculate($wave);

        $this->assertEquals(0, $kpi['products_count']);
        $this->assertEquals(0, $kpi['materials_count']);
        $this->assertEquals(0, $kpi['missing_materials_count']);
        $this->assertEquals(0, $kpi['prepared_count']);
        $this->assertEquals(0, $kpi['remaining_count']);
        $this->assertEquals(0.0, $kpi['completion_pct']);
    }

    public function test_completion_pct_derived_from_product_demand(): void
    {
        $wave = $this->makeWave();
        $this->seedProductDemand($wave, 'p1', required: 10.0, prepared: 4.0);
        $this->seedProductDemand($wave, 'p2', required: 10.0, prepared: 6.0);

        $kpi = $this->calculator->calculate($wave);

        $this->assertEquals(2, $kpi['products_count']);
        $this->assertEquals(50.0, $kpi['completion_pct']); // 10/20 = 50%
        $this->assertEquals(0, $kpi['prepared_count']);  // neither fully done
        $this->assertEquals(2, $kpi['remaining_count']);
    }

    public function test_prepared_count_counts_fully_prepared_products(): void
    {
        $wave = $this->makeWave();
        $this->seedProductDemand($wave, 'p1', required: 5.0, prepared: 5.0); // done
        $this->seedProductDemand($wave, 'p2', required: 5.0, prepared: 2.0); // partial

        $kpi = $this->calculator->calculate($wave);

        $this->assertEquals(1, $kpi['prepared_count']);
        $this->assertEquals(1, $kpi['remaining_count']);
    }

    public function test_missing_materials_count_from_material_demand(): void
    {
        $wave = $this->makeWave();
        $this->seedMaterialDemand($wave, 'mat-1', missingQty: 5.0);
        $this->seedMaterialDemand($wave, 'mat-2', missingQty: 0.0);
        $this->seedMaterialDemand($wave, 'mat-3', missingQty: 2.0);

        $kpi = $this->calculator->calculate($wave);

        $this->assertEquals(3, $kpi['materials_count']);
        $this->assertEquals(2, $kpi['missing_materials_count']);
    }

    public function test_orders_count_taken_from_wave_model(): void
    {
        $wave = $this->makeWave(ordersCount: 7);

        $kpi = $this->calculator->calculate($wave);

        $this->assertEquals(7, $kpi['orders_count']);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeWave(int $ordersCount = 0): PreparationWave
    {
        return PreparationWave::create([
            'company_id' => $this->company->id,
            'warehouse_id' => $this->warehouse->id,
            'wave_number' => 'PREP-KPI-'.random_int(1, 99999),
            'planning_date' => today()->toDateString(),
            'status' => WaveStatus::Collecting->value,
            'orders_count' => $ordersCount,
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

    private function seedProductDemand(PreparationWave $wave, string $productId, float $required, float $prepared): void
    {
        $remaining = max(0.0, $required - $prepared);
        DB::table('wave_product_demand')->insert([
            'id' => (string) Str::uuid(),
            'company_id' => $wave->company_id,
            'warehouse_id' => $wave->warehouse_id,
            'preparation_wave_id' => $wave->id,
            'product_id' => $productId,
            'product_name' => 'Product '.$productId,
            'required_qty' => $required,
            'prepared_qty' => $prepared,
            'remaining_qty' => $remaining,
            'orders_count' => 1,
            'completion_pct' => $required > 0 ? ($prepared / $required) * 100 : 0,
            'last_calculated_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function seedMaterialDemand(PreparationWave $wave, string $materialId, float $missingQty): void
    {
        DB::table('wave_material_demand')->insert([
            'id' => (string) Str::uuid(),
            'company_id' => $wave->company_id,
            'warehouse_id' => $wave->warehouse_id,
            'preparation_wave_id' => $wave->id,
            'material_id' => $materialId,
            'material_name' => 'Material '.$materialId,
            'required_qty' => 10.0,
            'available_qty' => max(0.0, 10.0 - $missingQty),
            'reserved_qty' => 0,
            'expected_today' => 0,
            'in_transit_qty' => 0,
            'missing_qty' => $missingQty,
            'coverage_pct' => $missingQty > 0 ? ((10.0 - $missingQty) / 10.0) * 100 : 100,
            'last_calculated_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
