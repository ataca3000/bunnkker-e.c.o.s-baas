<?php

declare(strict_types=1);

namespace Tests\Feature\Operations\WaveEngine;

use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Operations\Preparation\Application\Services\WaveEngine\DemandRefreshDispatcher;
use Modules\Operations\Preparation\Application\Services\WaveEngine\WaveLifecycleService;
use Modules\Operations\Preparation\Application\Services\WaveEngine\WaveManager;
use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Modules\Operations\Preparation\Domain\Events\WaveClosed;
use Modules\Operations\Preparation\Domain\Events\WaveCreated;
use Modules\Operations\Preparation\Domain\Events\WaveRotated;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

class WaveLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private Company $company;

    private Warehouse $warehouse;

    private WaveLifecycleService $lifecycle;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);

        $this->lifecycle = new WaveLifecycleService(
            new WaveManager,
            new DemandRefreshDispatcher,
        );
    }

    // ── createCollectingWave ──────────────────────────────────────────────────

    public function test_creates_collecting_wave_with_correct_status(): void
    {
        Event::fake();

        $today = today()->toDateString();
        $wave = $this->lifecycle->createCollectingWave(
            $this->company->id,
            $this->warehouse->id,
            $today,
        );

        $this->assertSame(WaveStatus::Collecting, $wave->status);
        $this->assertSame($this->company->id, $wave->company_id);
        $this->assertSame($this->warehouse->id, $wave->warehouse_id);
        $this->assertSame($today, $wave->planning_date->toDateString());
        $this->assertStringStartsWith('PREP-', $wave->wave_number);

        Event::assertDispatched(WaveCreated::class, fn ($e) => $e->waveId === $wave->id);
    }

    public function test_creates_incremental_wave_numbers_in_same_month(): void
    {
        $today = today()->toDateString();

        $wave1 = $this->lifecycle->createCollectingWave(
            $this->company->id,
            $this->warehouse->id,
            $today,
        );

        // Close first wave so we can create a second for a different date
        $this->lifecycle->closeWave($wave1);

        $tomorrow = today()->addDay()->toDateString();
        $wave2 = $this->lifecycle->createCollectingWave(
            $this->company->id,
            $this->warehouse->id,
            $tomorrow,
        );

        $seq1 = (int) substr($wave1->wave_number, -6);
        $seq2 = (int) substr($wave2->wave_number, -6);

        $this->assertSame($seq1 + 1, $seq2);
    }

    // ── Idempotency ───────────────────────────────────────────────────────────

    public function test_create_is_idempotent_returns_existing_collecting_wave(): void
    {
        $today = today()->toDateString();

        $wave1 = $this->lifecycle->createCollectingWave($this->company->id, $this->warehouse->id, $today);
        $wave2 = $this->lifecycle->createCollectingWave($this->company->id, $this->warehouse->id, $today);

        $this->assertSame($wave1->id, $wave2->id);
        $this->assertSame(1, PreparationWave::count());
    }

    public function test_close_is_idempotent_for_already_closed_wave(): void
    {
        Event::fake();

        $wave = $this->makeCollectingWave();

        // Close once → Preparing first
        $wave->update(['status' => WaveStatus::Preparing->value]);
        $wave->refresh();

        $this->lifecycle->closeWave($wave);
        $this->lifecycle->closeWave($wave); // second call — must not throw

        Event::assertDispatchedTimes(WaveClosed::class, 1);
    }

    // ── closeWave ─────────────────────────────────────────────────────────────

    public function test_closes_preparing_wave_and_dispatches_event(): void
    {
        Event::fake();

        $wave = $this->makeCollectingWave();
        $wave->update(['status' => WaveStatus::Preparing->value]);
        $wave->refresh();

        $closed = $this->lifecycle->closeWave($wave, 'system', 'scheduled');

        $this->assertSame(WaveStatus::Closed, $closed->status);
        $this->assertNotNull($closed->completed_at);

        Event::assertDispatched(WaveClosed::class, function ($e) use ($closed) {
            return $e->waveId === $closed->id && $e->reason === 'scheduled';
        });
    }

    public function test_close_does_not_affect_already_terminal_wave(): void
    {
        Event::fake();

        $wave = $this->makeCollectingWave();
        $wave->update(['status' => WaveStatus::Completed->value]);
        $wave->refresh();

        $this->lifecycle->closeWave($wave);

        Event::assertNotDispatched(WaveClosed::class);
        $this->assertSame(WaveStatus::Completed, $wave->refresh()->status);
    }

    // ── rotateWave ────────────────────────────────────────────────────────────

    public function test_rotate_closes_current_and_creates_next_day_wave(): void
    {
        Event::fake();

        $wave = $this->makeCollectingWave();
        $wave->update(['status' => WaveStatus::Preparing->value]);
        $wave->refresh();

        $newWave = $this->lifecycle->rotateWave($wave);

        // Old wave is closed
        $this->assertSame(WaveStatus::Closed, $wave->refresh()->status);

        // New wave is Collecting for next day
        $expectedDate = Carbon::parse($wave->planning_date)->addDay()->toDateString();
        $this->assertSame(WaveStatus::Collecting, $newWave->status);
        $this->assertSame($expectedDate, $newWave->planning_date->toDateString());

        Event::assertDispatched(WaveClosed::class);
        Event::assertDispatched(WaveRotated::class, fn ($e) => $e->closedWaveId === $wave->id && $e->newWaveId === $newWave->id);
    }

    public function test_rotate_uses_same_company_and_warehouse(): void
    {
        $wave = $this->makeCollectingWave();
        $wave->update(['status' => WaveStatus::Preparing->value]);
        $wave->refresh();

        $newWave = $this->lifecycle->rotateWave($wave);

        $this->assertSame($this->company->id, $newWave->company_id);
        $this->assertSame($this->warehouse->id, $newWave->warehouse_id);
    }

    // ── Warehouse isolation ───────────────────────────────────────────────────

    public function test_waves_are_isolated_per_warehouse(): void
    {
        $warehouse2 = Warehouse::factory()->create(['company_id' => $this->company->id]);
        $today = today()->toDateString();

        $wave1 = $this->lifecycle->createCollectingWave($this->company->id, $this->warehouse->id, $today);
        $wave2 = $this->lifecycle->createCollectingWave($this->company->id, $warehouse2->id, $today);

        $this->assertNotSame($wave1->id, $wave2->id);
        $this->assertSame(2, PreparationWave::count());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeCollectingWave(?string $date = null): PreparationWave
    {
        return PreparationWave::create([
            'company_id' => $this->company->id,
            'warehouse_id' => $this->warehouse->id,
            'wave_number' => 'PREP-'.now()->format('Ym').'-'.str_pad((string) random_int(1, 9999), 6, '0', STR_PAD_LEFT),
            'planning_date' => $date ?? today()->toDateString(),
            'status' => WaveStatus::Collecting->value,
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
