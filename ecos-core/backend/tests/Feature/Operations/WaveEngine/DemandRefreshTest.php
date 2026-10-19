<?php

declare(strict_types=1);

namespace Tests\Feature\Operations\WaveEngine;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Operations\Preparation\Application\Services\WaveEngine\DemandRefreshDispatcher;
use Modules\Operations\Preparation\Application\Services\WaveEngine\WaveLifecycleService;
use Modules\Operations\Preparation\Application\Services\WaveEngine\WaveManager;
use Modules\Operations\Preparation\Application\Services\WaveEngine\WavePreparationService;
use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Modules\Operations\Preparation\Domain\Events\DemandRefreshRequested;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

class DemandRefreshTest extends TestCase
{
    use RefreshDatabase;

    private Company $company;

    private Warehouse $warehouse;

    private DemandRefreshDispatcher $dispatcher;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);
        $this->dispatcher = new DemandRefreshDispatcher;
    }

    public function test_dispatcher_fires_demand_refresh_requested(): void
    {
        Event::fake();

        $wave = $this->makeWave();
        $this->dispatcher->dispatch($wave, 'order_added', 'system');

        Event::assertDispatched(DemandRefreshRequested::class, function ($e) use ($wave) {
            return $e->waveId === $wave->id
                && $e->companyId === $wave->company_id
                && $e->warehouseId === $wave->warehouse_id
                && $e->trigger === 'order_added'
                && $e->requestedBy === 'system';
        });
    }

    public function test_demand_refresh_triggered_on_preparation_start(): void
    {
        Event::fake();

        $wave = $this->makeWave(WaveStatus::Collecting);
        $svc = new WavePreparationService($this->dispatcher);

        $svc->startPreparation($wave);

        Event::assertDispatched(DemandRefreshRequested::class, fn ($e) => $e->trigger === 'preparation_started');
    }

    public function test_demand_refresh_triggered_on_wave_creation(): void
    {
        Event::fake();

        $lifecycle = new WaveLifecycleService(new WaveManager, $this->dispatcher);
        $lifecycle->createCollectingWave($this->company->id, $this->warehouse->id, today()->toDateString());

        // Wave creation fires WaveCreated but no demand refresh (demand is zero at creation)
        Event::assertNotDispatched(DemandRefreshRequested::class);
    }

    public function test_event_carries_correct_trigger_strings(): void
    {
        Event::fake();

        $wave = $this->makeWave();
        $this->dispatcher->dispatch($wave, 'order_removed');

        Event::assertDispatched(DemandRefreshRequested::class, fn ($e) => $e->trigger === 'order_removed');
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeWave(WaveStatus $status = WaveStatus::Collecting): PreparationWave
    {
        return PreparationWave::create([
            'company_id' => $this->company->id,
            'warehouse_id' => $this->warehouse->id,
            'wave_number' => 'PREP-'.now()->format('Ym').'-'.str_pad((string) random_int(1, 9999), 6, '0', STR_PAD_LEFT),
            'planning_date' => today()->toDateString(),
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
