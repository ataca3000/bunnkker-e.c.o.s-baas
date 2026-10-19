<?php

declare(strict_types=1);

namespace Tests\Feature\Operations;

use App\Core\FeatureFlags\FeatureFlagService;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Operations\Preparation\Application\Services\SoftReservationService;
use Modules\Operations\Preparation\Domain\Enums\ReservableType;
use Modules\Operations\Preparation\Domain\Enums\ReservationStatus;
use Modules\Operations\Preparation\Domain\Models\PreparationInventoryReservation;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

class SoftReservationTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Company $company;

    private Warehouse $warehouse;

    private SoftReservationService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->warehouse = Warehouse::factory()->create(['company_id' => $this->company->id]);
        $this->user = User::factory()->create(['company_id' => $this->company->id]);
        $this->service = app(SoftReservationService::class);

        $flags = app(FeatureFlagService::class);
        $flags->enable('workflow.stages.preparation', $this->company->id);
    }

    private function makeWave(): PreparationWave
    {
        return PreparationWave::create([
            'company_id' => $this->company->id,
            'warehouse_id' => $this->warehouse->id,
            'wave_number' => 'PREP-'.now()->format('Ym').'-'.str_pad((string) random_int(1, 9999), 6, '0', STR_PAD_LEFT),
            'planning_date' => now()->addDay()->toDateString(),
            'status' => 'preparing',
            'orders_count' => 0,
            'products_count' => 0,
            'lines_count' => 0,
            'total_units_required' => 0,
            'total_units_prepared' => 0,
            'shortage_detected' => false,
            'created_by' => (string) $this->user->id,
            'updated_by' => (string) $this->user->id,
        ]);
    }

    private function seedReservation(PreparationWave $wave, string $status = 'created', float $qty = 10.0): PreparationInventoryReservation
    {
        return PreparationInventoryReservation::create([
            'company_id' => $this->company->id,
            'preparation_wave_id' => $wave->id,
            'reservable_type' => ReservableType::RawMaterial->value,
            'reservable_id' => Str::uuid()->toString(),
            'reservable_name_snapshot' => 'Test Material',
            'quantity_reserved' => $qty,
            'status' => $status,
            'created_by' => (string) $this->user->id,
            'updated_by' => (string) $this->user->id,
        ]);
    }

    public function test_release_marks_created_reservation_as_released(): void
    {
        $wave = $this->makeWave();
        $res = $this->seedReservation($wave, 'created');

        $this->service->release($wave, (string) $this->user->id);

        $res->refresh();
        $this->assertEquals(ReservationStatus::Released->value, $res->status->value);
        $this->assertNotNull($res->released_at);
        $this->assertEquals((string) $this->user->id, $res->released_by);
    }

    public function test_release_ignores_already_consumed_reservations(): void
    {
        $wave = $this->makeWave();
        $this->seedReservation($wave, 'consumed');

        $this->service->release($wave, (string) $this->user->id);

        $count = PreparationInventoryReservation::where('preparation_wave_id', $wave->id)
            ->where('status', 'released')
            ->count();
        $this->assertEquals(0, $count);
    }

    public function test_consume_marks_created_reservation_as_consumed(): void
    {
        $wave = $this->makeWave();
        $res = $this->seedReservation($wave, 'created');

        $this->service->consume($wave, (string) $this->user->id);

        $res->refresh();
        $this->assertEquals(ReservationStatus::Consumed->value, $res->status->value);
        $this->assertNotNull($res->consumed_at);
        $this->assertEquals((string) $this->user->id, $res->consumed_by);
    }

    public function test_total_reserved_sums_active_reservations_only(): void
    {
        $wave = $this->makeWave();
        $rmId = Str::uuid()->toString();

        foreach (['created', 'updated', 'consumed'] as $status) {
            PreparationInventoryReservation::create([
                'company_id' => $this->company->id,
                'preparation_wave_id' => $wave->id,
                'reservable_type' => ReservableType::RawMaterial->value,
                'reservable_id' => $rmId,
                'reservable_name_snapshot' => 'Flour',
                'quantity_reserved' => 5.0,
                'status' => $status,
                'created_by' => (string) $this->user->id,
                'updated_by' => (string) $this->user->id,
            ]);
        }

        $total = $this->service->totalReserved(
            $this->company->id,
            $rmId,
            ReservableType::RawMaterial->value,
        );

        // created(5) + updated(5) = 10; consumed does NOT count
        $this->assertEquals(10.0, $total);
    }

    public function test_released_reservations_excluded_from_total_reserved(): void
    {
        $wave = $this->makeWave();
        $rmId = Str::uuid()->toString();

        PreparationInventoryReservation::create([
            'company_id' => $this->company->id,
            'preparation_wave_id' => $wave->id,
            'reservable_type' => ReservableType::RawMaterial->value,
            'reservable_id' => $rmId,
            'reservable_name_snapshot' => 'Sugar',
            'quantity_reserved' => 8.0,
            'status' => 'created',
            'created_by' => (string) $this->user->id,
            'updated_by' => (string) $this->user->id,
        ]);

        $this->service->release($wave, (string) $this->user->id);

        $total = $this->service->totalReserved(
            $this->company->id,
            $rmId,
            ReservableType::RawMaterial->value,
        );

        $this->assertEquals(0.0, $total);
    }
}
