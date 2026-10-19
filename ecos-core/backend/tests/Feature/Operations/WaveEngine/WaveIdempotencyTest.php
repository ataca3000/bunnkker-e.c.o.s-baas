<?php

declare(strict_types=1);

namespace Tests\Feature\Operations\WaveEngine;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Operations\Preparation\Application\Services\WaveEngine\DemandRefreshDispatcher;
use Modules\Operations\Preparation\Application\Services\WaveEngine\WaveLifecycleService;
use Modules\Operations\Preparation\Application\Services\WaveEngine\WaveManager;
use Modules\Operations\Preparation\Application\Services\WaveEngine\WaveMembershipService;
use Modules\Operations\Preparation\Application\Services\WaveEngine\WavePreparationService;
use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Modules\Operations\Preparation\Domain\Events\WaveClosed;
use Modules\Operations\Preparation\Domain\Events\WaveCreated;
use Modules\Operations\Preparation\Domain\Events\WavePreparationStarted;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Operations\Preparation\Domain\Models\PreparationWaveOrder;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * Verifies that concurrent or duplicate scheduler executions cannot create
 * duplicate waves, duplicate order memberships, or repeated state transitions.
 */
class WaveIdempotencyTest extends TestCase
{
    use RefreshDatabase;

    private Company $company;

    private Warehouse $warehouse;

    private WaveLifecycleService $lifecycle;

    private WavePreparationService $preparationSvc;

    private WaveMembershipService $membership;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);

        $dispatcher = new DemandRefreshDispatcher;
        $this->lifecycle = new WaveLifecycleService(new WaveManager, $dispatcher);
        $this->preparationSvc = new WavePreparationService($dispatcher);
        $this->membership = new WaveMembershipService($dispatcher);
    }

    public function test_duplicate_wave_creation_returns_same_wave(): void
    {
        Event::fake();

        $today = today()->toDateString();

        $a = $this->lifecycle->createCollectingWave($this->company->id, $this->warehouse->id, $today);
        $b = $this->lifecycle->createCollectingWave($this->company->id, $this->warehouse->id, $today);
        $c = $this->lifecycle->createCollectingWave($this->company->id, $this->warehouse->id, $today);

        $this->assertSame($a->id, $b->id);
        $this->assertSame($a->id, $c->id);
        $this->assertSame(1, PreparationWave::count());
        Event::assertDispatchedTimes(WaveCreated::class, 1);
    }

    public function test_duplicate_preparation_start_does_not_double_fire_events(): void
    {
        Event::fake();

        $wave = $this->makeWave(WaveStatus::Collecting);

        $this->preparationSvc->startPreparation($wave);
        $this->preparationSvc->startPreparation($wave->refresh());
        $this->preparationSvc->startPreparation($wave->refresh());

        Event::assertDispatchedTimes(WavePreparationStarted::class, 1);
        $this->assertSame(WaveStatus::Preparing, $wave->refresh()->status);
    }

    public function test_duplicate_wave_closure_fires_event_only_once(): void
    {
        Event::fake();

        $wave = $this->makeWave(WaveStatus::Preparing);

        $this->lifecycle->closeWave($wave);
        $this->lifecycle->closeWave($wave->refresh());

        Event::assertDispatchedTimes(WaveClosed::class, 1);
    }

    public function test_duplicate_order_attachment_is_ignored_via_unique_constraint(): void
    {
        $wave = $this->makeWave(WaveStatus::Collecting);
        $orderId = 'order-idempotency-test';

        $this->attachOrderRecord($wave, $orderId, 'ORD-IDEM');
        $this->attachOrderRecord($wave, $orderId, 'ORD-IDEM'); // duplicate

        $this->assertSame(1, PreparationWaveOrder::where('order_id', $orderId)->count());
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
        // Use DB insert to catch duplicate silently (mirrors what MembershipService does via try/catch)
        try {
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
        } catch (\Illuminate\Database\UniqueConstraintViolationException) {
            // Expected on duplicate — test asserts only 1 row exists
        }
    }
}
