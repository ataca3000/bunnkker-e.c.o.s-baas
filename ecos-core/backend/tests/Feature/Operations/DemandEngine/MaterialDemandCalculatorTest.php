<?php

declare(strict_types=1);

namespace Tests\Feature\Operations\DemandEngine;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Operations\DemandAnalysis\Application\Services\MaterialDemandCalculator;
use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * Tests BOM explosion and material aggregation.
 * Seeds wave_product_demand directly (bypassing the product calculator)
 * so this test is isolated to material logic only.
 */
class MaterialDemandCalculatorTest extends TestCase
{
    use RefreshDatabase;

    private Company $company;

    private Warehouse $warehouse;

    private MaterialDemandCalculator $calculator;

    private string $categoryId;

    private string $unitId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);

        // products.category_id and products.unit_id are NOT NULL. makeProduct()
        // inserts raw, so no model or factory default applies.
        $this->categoryId = (string) \Modules\MasterData\Categories\Domain\Models\Category::factory()->create()->id;
        $this->unitId = (string) \Modules\MasterData\Units\Domain\Models\Unit::factory()->create()->id;

        $this->calculator = new MaterialDemandCalculator;
    }

    // ── Recipe explosion ──────────────────────────────────────────────────────

    public function test_explodes_single_ingredient_bom(): void
    {
        $wave = $this->makeWave();
        $finishedGood = $this->makeProduct('Cake', 'finished_good');
        $flour = $this->makeProduct('Flour', 'raw_material');

        $this->seedProductDemand($wave, $finishedGood, requiredQty: 10.0);
        $this->makeBom($finishedGood, [$flour => 2.0]); // 2kg flour per cake

        $rows = $this->calculator->calculate($wave);

        $this->assertCount(1, $rows);
        $this->assertEquals($flour, $rows[0]['material_id']);
        $this->assertEquals(20.0, $rows[0]['required_qty']); // 10 cakes × 2kg
    }

    public function test_aggregates_same_material_across_multiple_products(): void
    {
        $wave = $this->makeWave();
        $productA = $this->makeProduct('Product A', 'finished_good');
        $productB = $this->makeProduct('Product B', 'finished_good');
        $flour = $this->makeProduct('Flour', 'raw_material');

        $this->seedProductDemand($wave, $productA, 10.0);
        $this->seedProductDemand($wave, $productB, 5.0);
        $this->makeBom($productA, [$flour => 1.0]);
        $this->makeBom($productB, [$flour => 2.0]);

        $rows = $this->calculator->calculate($wave);
        $flours = collect($rows)->where('material_id', $flour);

        $this->assertCount(1, $flours); // single aggregated row
        $this->assertEquals(20.0, $flours->first()['required_qty']); // 10×1 + 5×2
    }

    public function test_applies_waste_percentage_to_required_qty(): void
    {
        $wave = $this->makeWave();
        $product = $this->makeProduct('Widget', 'finished_good');
        $material = $this->makeProduct('Steel', 'raw_material');

        $this->seedProductDemand($wave, $product, 100.0);
        $this->makeBom($product, [$material => 1.0], wastePct: 10.0); // 10% waste

        $rows = $this->calculator->calculate($wave);
        $row = collect($rows)->firstWhere('material_id', $material);

        // 100 × 1.0 × (1 + 0.10) = 110
        $this->assertEquals(110.0, $row['required_qty']);
    }

    // ── Coverage calculations ─────────────────────────────────────────────────

    public function test_coverage_pct_is_100_when_fully_covered(): void
    {
        $wave = $this->makeWave();
        $product = $this->makeProduct('P', 'finished_good');
        $material = $this->makeProduct('M', 'raw_material');

        $this->seedProductDemand($wave, $product, 5.0);
        $this->makeBom($product, [$material => 2.0]);
        $this->seedInventory($material, onHand: 20.0, reserved: 0.0);

        $rows = $this->calculator->calculate($wave);
        $row = collect($rows)->firstWhere('material_id', $material);

        $this->assertEquals(100.0, $row['coverage_pct']);
        $this->assertEquals(0.0, $row['missing_qty']);
    }

    public function test_coverage_pct_is_capped_at_100(): void
    {
        $wave = $this->makeWave();
        $product = $this->makeProduct('P', 'finished_good');
        $material = $this->makeProduct('M', 'raw_material');

        $this->seedProductDemand($wave, $product, 1.0);
        $this->makeBom($product, [$material => 1.0]);
        $this->seedInventory($material, onHand: 999.0, reserved: 0.0); // way more than needed

        $rows = $this->calculator->calculate($wave);
        $row = collect($rows)->firstWhere('material_id', $material);

        $this->assertEquals(100.0, $row['coverage_pct']);
    }

    public function test_missing_qty_uses_available_not_on_hand(): void
    {
        $wave = $this->makeWave();
        $product = $this->makeProduct('P', 'finished_good');
        $material = $this->makeProduct('M', 'raw_material');

        $this->seedProductDemand($wave, $product, 10.0);
        $this->makeBom($product, [$material => 1.0]); // need 10 units
        // on_hand=15, reserved=8 → available=7 → missing=3
        $this->seedInventory($material, onHand: 15.0, reserved: 8.0);

        $rows = $this->calculator->calculate($wave);
        $row = collect($rows)->firstWhere('material_id', $material);

        $this->assertEquals(7.0, $row['available_qty']);
        $this->assertEquals(3.0, $row['missing_qty']);
    }

    public function test_product_without_bom_produces_no_material_rows(): void
    {
        $wave = $this->makeWave();
        $product = $this->makeProduct('No-BOM Product', 'finished_good');
        $this->seedProductDemand($wave, $product, 5.0);

        $rows = $this->calculator->calculate($wave);

        $this->assertEmpty($rows);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeWave(): PreparationWave
    {
        return PreparationWave::create([
            'company_id' => $this->company->id,
            'warehouse_id' => $this->warehouse->id,
            'wave_number' => 'PREP-MTEST-'.random_int(1, 99999),
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

    private function makeProduct(string $name, string $type): string
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
            'product_type' => $type,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $id;
    }

    /**
     * @param  array<string, float>  $ingredients  material_id → qty_per_unit
     */
    private function makeBom(string $productId, array $ingredients, float $wastePct = 0.0): void
    {
        $bomId = (string) Str::uuid();
        DB::table('bills_of_materials')->insert([
            'id' => $bomId,
            'product_id' => $productId,
            'bom_number' => 'BOM-'.random_int(1000, 9999),
            'version' => 1,
            'bom_version_number' => 1,
            'is_active' => true,
            'yield_quantity' => 1,
            'recipe_cost' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach ($ingredients as $materialId => $qty) {
            DB::table('bill_of_material_lines')->insert([
                'id' => (string) Str::uuid(),
                'bom_id' => $bomId,
                'raw_material_id' => $materialId,
                'quantity' => $qty,
                'waste_percentage' => $wastePct,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    private function seedProductDemand(PreparationWave $wave, string $productId, float $requiredQty): void
    {
        DB::table('wave_product_demand')->insert([
            'id' => (string) Str::uuid(),
            'company_id' => $wave->company_id,
            'warehouse_id' => $wave->warehouse_id,
            'preparation_wave_id' => $wave->id,
            'product_id' => $productId,
            'product_name' => 'Product '.$productId,
            'required_qty' => $requiredQty,
            'prepared_qty' => 0,
            'remaining_qty' => $requiredQty,
            'orders_count' => 1,
            'completion_pct' => 0,
            'last_calculated_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function seedInventory(string $productId, float $onHand, float $reserved): void
    {
        DB::table('inventory_items')->insert([
            'id' => (string) Str::uuid(),
            'warehouse_id' => $this->warehouse->id,
            'product_id' => $productId,
            'company_id' => $this->company->id,
            'on_hand_qty' => $onHand,
            'reserved_qty' => $reserved,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
