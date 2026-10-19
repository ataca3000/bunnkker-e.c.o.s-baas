<?php

declare(strict_types=1);

namespace Tests\Feature\Operations\WaveEngine;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use LogicException;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Operations\Preparation\Application\Services\WaveEngine\DemandRefreshDispatcher;
use Modules\Operations\Preparation\Application\Services\WaveEngine\WavePreparationService;
use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Modules\Operations\Preparation\Domain\Events\DemandRefreshRequested;
use Modules\Operations\Preparation\Domain\Events\OrderMovedToPreparing;
use Modules\Operations\Preparation\Domain\Events\WavePreparationStarted;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Operations\Preparation\Domain\Models\PreparationWaveOrder;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

class WavePreparationTransitionTest extends TestCase
{
    use RefreshDatabase;

    private Company $company;

    private Warehouse $warehouse;

    private WavePreparationService $preparationSvc;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);

        $this->preparationSvc = new WavePreparationService(
            new DemandRefreshDispatcher,
        );
    }

    public function test_transitions_collecting_to_preparing(): void
    {
        Event::fake();

        $wave = $this->makeWave(WaveStatus::Collecting);
        $result = $this->preparationSvc->startPreparation($wave);

        $this->assertSame(WaveStatus::Preparing, $result->status);
        $this->assertNotNull($result->started_at);
        $this->assertSame('system', $result->started_by);
    }

    public function test_dispatches_wave_preparation_started_event(): void
    {
        Event::fake();

        $wave = $this->makeWave(WaveStatus::Collecting);
        $this->preparationSvc->startPreparation($wave);

        Event::assertDispatched(WavePreparationStarted::class, fn ($e) => $e->waveId === $wave->id);
    }

    public function test_dispatches_order_moved_to_preparing_for_each_existing_order(): void
    {
        Event::fake();

        $wave = $this->makeWave(WaveStatus::Collecting);
        $this->attachOrderRecord($wave, 'order-1', 'ORD-001');
        $this->attachOrderRecord($wave, 'order-2', 'ORD-002');

        $this->preparationSvc->startPreparation($wave);

        Event::assertDispatched(OrderMovedToPreparing::class, fn ($e) => $e->orderId === 'order-1');
        Event::assertDispatched(OrderMovedToPreparing::class, fn ($e) => $e->orderId === 'order-2');
        Event::assertDispatchedTimes(OrderMovedToPreparing::class, 2);
    }

    public function test_dispatches_demand_refresh_after_preparation_start(): void
    {
        Event::fake();

        $wave = $this->makeWave(WaveStatus::Collecting);
        $this->preparationSvc->startPreparation($wave);

        Event::assertDispatched(DemandRefreshRequested::class, fn ($e) => $e->trigger === 'preparation_started');
    }

    public function test_start_preparation_is_idempotent_for_already_preparing_wave(): void
    {
        Event::fake();

        $wave = $this->makeWave(WaveStatus::Preparing);

        $result = $this->preparationSvc->startPreparation($wave);
        $this->assertSame(WaveStatus::Preparing, $result->status);

        Event::assertNotDispatched(WavePreparationStarted::class);
    }

    public function test_throws_when_wave_is_not_collecting(): void
    {
        $wave = $this->makeWave(WaveStatus::Planning);

        $this->expectException(LogicException::class);
        $this->preparationSvc->startPreparation($wave);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeWave(WaveStatus $status): PreparationWave
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

    private function attachOrderRecord(PreparationWave $wave, string $orderId, string $orderNumber): void
    {
        PreparationWaveOrder::create([
            'company_id' => $wave->company_id,
            'preparation_wave_id' => $wave->id,
            'order_id' => $orderId,
            'order_number' => $orderNumber,
            'order_confirmed_at' => now(),
            'is_paid' => false,
            'preparation_priority' => 5,
            'added_at' => now(),
            'added_by' => 'system',
        ]);

        $wave->increment('orders_count');
    }
}
