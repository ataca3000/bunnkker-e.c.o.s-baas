<?php

declare(strict_types=1);

namespace Tests\Feature\Operations\DemandEngine;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Operations\DemandAnalysis\Application\Services\MissingMaterialCalculator;
use Modules\Operations\DemandAnalysis\Domain\Enums\MaterialPriority;
use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

class MissingMaterialCalculatorTest extends TestCase
{
    use RefreshDatabase;

    private Company $company;

    private Warehouse $warehouse;

    private MissingMaterialCalculator $calculator;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);
        $this->calculator = new MissingMaterialCalculator;
    }

    // ── Missing qty calculation ───────────────────────────────────────────────

    public function test_only_returns_materials_with_shortage(): void
    {
        $wave = $this->makeWave();
        $this->seedMaterialDemand($wave, 'mat-A', 10.0, 10.0); // covered
        $this->seedMaterialDemand($wave, 'mat-B', 10.0, 3.0); // short

        $rows = $this->calculator->calculate($wave);

        $this->assertCount(1, $rows);
        $this->assertEquals('mat-B', $rows[0]['material_id']);
    }

    public function test_missing_qty_never_negative(): void
    {
        $wave = $this->makeWave();
        // available > required — should still show as 0 missing, not negative
        $this->seedMaterialDemand($wave, 'mat-X', 5.0, 20.0);

        $rows = $this->calculator->calculate($wave);

        $this->assertEmpty($rows); // 0 missing → not in the missing table
    }

    // ── Priority calculations ─────────────────────────────────────────────────

    public function test_critical_priority_above_80_percent_shortage(): void
    {
        $priority = MaterialPriority::fromShortageRatio(9.0, 10.0); // 90% missing
        $this->assertSame(MaterialPriority::Critical, $priority);
    }

    public function test_high_priority_above_50_percent_shortage(): void
    {
        $priority = MaterialPriority::fromShortageRatio(6.0, 10.0); // 60% missing
        $this->assertSame(MaterialPriority::High, $priority);
    }

    public function test_medium_priority_above_20_percent_shortage(): void
    {
        $priority = MaterialPriority::fromShortageRatio(3.0, 10.0); // 30% missing
        $this->assertSame(MaterialPriority::Medium, $priority);
    }

    public function test_low_priority_at_or_below_20_percent_shortage(): void
    {
        $priority = MaterialPriority::fromShortageRatio(2.0, 10.0); // 20% missing
        $this->assertSame(MaterialPriority::Low, $priority);
    }

    public function test_missing_rows_carry_correct_priority(): void
    {
        $wave = $this->makeWave();
        $this->seedMaterialDemand($wave, 'mat-critical', 10.0, 0.5); // 95% missing
        $this->seedMaterialDemand($wave, 'mat-low', 10.0, 9.0); // 10% missing

        $rows = $this->calculator->calculate($wave);

        $byId = collect($rows)->keyBy('material_id');
        $this->assertEquals('critical', $byId['mat-critical']['priority']);
        $this->assertEquals('low', $byId['mat-low']['priority']);
    }

    // ── Incremental scoping ───────────────────────────────────────────────────

    public function test_scoped_to_affected_material_ids_only(): void
    {
        $wave = $this->makeWave();
        $this->seedMaterialDemand($wave, 'mat-1', 10.0, 2.0); // short
        $this->seedMaterialDemand($wave, 'mat-2', 10.0, 2.0); // short

        // Only recalculate mat-1
        $rows = $this->calculator->calculate($wave, ['mat-1']);

        $this->assertCount(1, $rows);
        $this->assertEquals('mat-1', $rows[0]['material_id']);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeWave(): PreparationWave
    {
        return PreparationWave::create([
            'company_id' => $this->company->id,
            'warehouse_id' => $this->warehouse->id,
            'wave_number' => 'PREP-MISS-'.random_int(1, 99999),
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

    private function seedMaterialDemand(
        PreparationWave $wave,
        string $materialId,
        float $required,
        float $available,
    ): void {
        $missing = max(0.0, $required - $available);
        $coverage = $required > 0 ? min(100.0, ($available / $required) * 100.0) : 100.0;

        DB::table('wave_material_demand')->insert([
            'id' => (string) Str::uuid(),
            'company_id' => $wave->company_id,
            'warehouse_id' => $wave->warehouse_id,
            'preparation_wave_id' => $wave->id,
            'material_id' => $materialId,
            'material_name' => 'Material '.$materialId,
            'required_qty' => $required,
            'available_qty' => $available,
            'reserved_qty' => 0,
            'expected_today' => 0,
            'in_transit_qty' => 0,
            'missing_qty' => $missing,
            'coverage_pct' => $coverage,
            'last_calculated_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
