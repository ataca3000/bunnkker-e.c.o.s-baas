<?php

declare(strict_types=1);

namespace Tests\Feature\Operations\WaveEngine;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Operations\Preparation\Application\Services\WaveEngine\WaveManager;
use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

class WaveManagerTest extends TestCase
{
    use RefreshDatabase;

    private Company $company;

    private Warehouse $warehouse;

    private WaveManager $manager;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);
        $this->manager = new WaveManager;
    }

    public function test_returns_null_when_no_active_wave_exists(): void
    {
        $this->assertNull($this->manager->getActiveWave($this->company->id, $this->warehouse->id));
        $this->assertFalse($this->manager->hasActiveWave($this->company->id, $this->warehouse->id));
    }

    public function test_detects_collecting_wave_as_active(): void
    {
        $wave = $this->makeWave(WaveStatus::Collecting);

        $found = $this->manager->getActiveWave($this->company->id, $this->warehouse->id);

        $this->assertNotNull($found);
        $this->assertSame($wave->id, $found->id);
        $this->assertTrue($this->manager->hasActiveWave($this->company->id, $this->warehouse->id));
    }

    public function test_detects_preparing_wave_as_active(): void
    {
        $wave = $this->makeWave(WaveStatus::Preparing);

        $found = $this->manager->getActiveWave($this->company->id, $this->warehouse->id);

        $this->assertNotNull($found);
        $this->assertSame($wave->id, $found->id);
    }

    public function test_closed_wave_is_not_active(): void
    {
        $this->makeWave(WaveStatus::Closed);

        $this->assertNull($this->manager->getActiveWave($this->company->id, $this->warehouse->id));
        $this->assertFalse($this->manager->hasActiveWave($this->company->id, $this->warehouse->id));
    }

    public function test_completed_wave_is_not_active(): void
    {
        $this->makeWave(WaveStatus::Completed);

        $this->assertNull($this->manager->getActiveWave($this->company->id, $this->warehouse->id));
    }

    public function test_get_collecting_wave_returns_only_collecting_status(): void
    {
        $collecting = $this->makeWave(WaveStatus::Collecting);

        $this->assertSame($collecting->id, $this->manager->getCollectingWave($this->company->id, $this->warehouse->id)?->id);
        $this->assertNull($this->manager->getPreparingWave($this->company->id, $this->warehouse->id));
    }

    public function test_isolation_between_warehouses(): void
    {
        $warehouse2 = Warehouse::factory()->create(['company_id' => $this->company->id]);

        $wave1 = $this->makeWave(WaveStatus::Collecting);
        // No wave for warehouse2

        $this->assertTrue($this->manager->hasActiveWave($this->company->id, $this->warehouse->id));
        $this->assertFalse($this->manager->hasActiveWave($this->company->id, $warehouse2->id));
    }

    public function test_get_active_wave_for_date_matches_planning_date(): void
    {
        $today = today()->toDateString();
        $tomorrow = today()->addDay()->toDateString();

        $todayWave = $this->makeWave(WaveStatus::Collecting, $today);
        $this->makeWave(WaveStatus::Closed, $tomorrow);

        $found = $this->manager->getActiveWaveForDate($this->company->id, $this->warehouse->id, $today);
        $this->assertSame($todayWave->id, $found?->id);

        $none = $this->manager->getActiveWaveForDate($this->company->id, $this->warehouse->id, $tomorrow);
        $this->assertNull($none);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeWave(WaveStatus $status, ?string $date = null): PreparationWave
    {
        return PreparationWave::create([
            'company_id' => $this->company->id,
            'warehouse_id' => $this->warehouse->id,
            'wave_number' => 'PREP-'.now()->format('Ym').'-'.str_pad((string) random_int(1, 9999), 6, '0', STR_PAD_LEFT),
            'planning_date' => $date ?? today()->toDateString(),
            'status' => $status->value,
            'orders_count' => 0,
            'products_count' => 0,
            'lines_count' => 0,
            'total_units_required' => 0,
            'total_units_prepared' => 0,
            'shortage_detected' => false,
            'wave_type' => 'engine',
            'created_by' => 'system',
            'updated_by' => 'system',
        ]);
    }
}
