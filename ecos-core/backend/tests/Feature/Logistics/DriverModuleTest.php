<?php

declare(strict_types=1);

namespace Tests\Feature\Logistics;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Modules\Logistics\Drivers\Domain\Models\Driver;
use Modules\Logistics\Drivers\Domain\Models\DriverDocument;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;
use Modules\Logistics\Drivers\Domain\Services\DriverVehicleAssignmentService;
use Modules\Logistics\ShippingCompanies\Domain\Models\ShippingCompany;
use Tests\TestCase;

/**
 * TASK-LOG-002 — Drivers Module
 *
 * Business rules under test:
 *   BR-1 driver_code unique
 *   BR-2 national_id unique
 *   BR-3 mobile unique
 *   BR-4 a driver who has delivered is never deleted
 *   BR-5 drivers are archived, never deleted (no destroy endpoint exists)
 *   BR-6 a driver may hold at most one active vehicle
 *   BR-7 a vehicle may be held by at most one active driver
 *   BR-8 an expired licence bars a driver from starting deliveries
 */
class DriverModuleTest extends TestCase
{
    use DatabaseTransactions;

    private const BASE = '/api/logistics/drivers';

    private const VEHICLES = '/api/logistics/vehicles';

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    private function auth(): static
    {
        return $this->actingAs($this->user);
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'driver_code' => 'DRV-001',
            'full_name' => 'Mahmoud Adel',
            'mobile' => '01000000001',
            'national_id' => '29001011200011',
            'date_of_birth' => '1990-01-01',
            'address' => '5 Nasr Road, Cairo',
            'employment_date' => '2024-03-01',
            'license_number' => 'LIC-88213',
            'license_type' => 'Private',
            'license_issue_date' => '2024-01-01',
            'license_expiry_date' => '2030-01-01',
            'license_issuing_authority' => 'Cairo Traffic Dept',
        ], $overrides);
    }

    private function makeDriver(array $overrides = []): Driver
    {
        return Driver::create($this->payload($overrides));
    }

    private function makeVehicle(array $overrides = []): Vehicle
    {
        return Vehicle::create(array_merge([
            'vehicle_code' => 'VEH-'.substr(md5($overrides['plate_number'] ?? 'ABC-1234'), 0, 8),
            'plate_number' => 'ABC-1234',
            'type' => 'van',
            'capacity_orders' => 60,
            // TASK-LOG-003 widened the vehicle lifecycle: 'available' replaces 'active'.
            'status' => 'available',
        ], $overrides));
    }

    // ── Dashboard ─────────────────────────────────────────────────────────────

    public function test_stats_returns_all_dashboard_counters(): void
    {
        $this->makeDriver(['driver_code' => 'DRV-001', 'mobile' => '01000000001', 'national_id' => 'N1', 'status' => 'active']);
        $this->makeDriver(['driver_code' => 'DRV-002', 'mobile' => '01000000002', 'national_id' => 'N2', 'status' => 'inactive']);
        $this->makeDriver([
            'driver_code' => 'DRV-003', 'mobile' => '01000000003', 'national_id' => 'N3',
            'status' => 'active', 'license_expiry_date' => Carbon::today()->subDay()->toDateString(),
        ]);

        $this->auth()->getJson(self::BASE.'/stats')
            ->assertOk()
            ->assertJson([
                'total_drivers' => 3,
                'active_drivers' => 2,
                'inactive_drivers' => 1,
                'expired_license_drivers' => 1,
                'drivers_without_vehicle' => 3,
            ]);
    }

    public function test_stats_counts_expiring_licences_separately(): void
    {
        $this->makeDriver([
            'driver_code' => 'DRV-010', 'mobile' => '01000000010', 'national_id' => 'N10',
            'license_expiry_date' => Carbon::today()->addDays(10)->toDateString(),
        ]);

        $this->auth()->getJson(self::BASE.'/stats')
            ->assertOk()
            ->assertJsonPath('expiring_license_drivers', 1)
            ->assertJsonPath('expired_license_drivers', 0);
    }

    public function test_drivers_without_vehicle_excludes_assigned(): void
    {
        $driver = $this->makeDriver();
        $vehicle = $this->makeVehicle();
        app(DriverVehicleAssignmentService::class)->assign($driver, $vehicle);

        $this->auth()->getJson(self::BASE.'/stats')
            ->assertOk()
            ->assertJsonPath('drivers_without_vehicle', 0);
    }

    public function test_next_code_is_sequential(): void
    {
        $this->auth()->getJson(self::BASE.'/next-code')->assertOk()->assertJson(['code' => 'DRV-001']);

        $this->makeDriver(['driver_code' => 'DRV-001']);
        $this->makeDriver(['driver_code' => 'DRV-002', 'mobile' => '01000000002', 'national_id' => 'N2']);

        $this->auth()->getJson(self::BASE.'/next-code')->assertOk()->assertJson(['code' => 'DRV-003']);
    }

    // ── Create / uniqueness (BR-1, BR-2, BR-3) ────────────────────────────────

    public function test_store_creates_driver(): void
    {
        $this->auth()->postJson(self::BASE, $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.driver_code', 'DRV-001')
            ->assertJsonPath('data.full_name', 'Mahmoud Adel')
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.license_status', 'valid');

        $this->assertDatabaseHas('logistics_drivers', ['driver_code' => 'DRV-001']);
    }

    public function test_store_links_driver_to_shipping_company(): void
    {
        $carrier = ShippingCompany::create([
            'name' => 'ECOS Internal Fleet', 'code' => 'SHC-FLEET', 'type' => 'internal', 'status' => 'active',
        ]);

        $this->auth()->postJson(self::BASE, $this->payload(['shipping_company_id' => $carrier->id]))
            ->assertCreated()
            ->assertJsonPath('data.shipping_company_id', $carrier->id)
            ->assertJsonPath('data.shipping_company_name', 'ECOS Internal Fleet');
    }

    /** BR-1 */
    public function test_driver_code_must_be_unique(): void
    {
        $this->makeDriver(['driver_code' => 'DRV-001']);

        $this->auth()->postJson(self::BASE, $this->payload([
            'driver_code' => 'DRV-001', 'mobile' => '01099999999', 'national_id' => 'OTHER',
        ]))->assertStatus(422)->assertJsonValidationErrors('driver_code');
    }

    /** BR-2 */
    public function test_national_id_must_be_unique(): void
    {
        $this->makeDriver(['national_id' => 'NID-DUP']);

        $this->auth()->postJson(self::BASE, $this->payload([
            'driver_code' => 'DRV-777', 'mobile' => '01099999999', 'national_id' => 'NID-DUP',
        ]))->assertStatus(422)->assertJsonValidationErrors('national_id');
    }

    /** BR-3 */
    public function test_mobile_must_be_unique(): void
    {
        $this->makeDriver(['mobile' => '01055555555']);

        $this->auth()->postJson(self::BASE, $this->payload([
            'driver_code' => 'DRV-778', 'mobile' => '01055555555', 'national_id' => 'OTHER-2',
        ]))->assertStatus(422)->assertJsonValidationErrors('mobile');
    }

    public function test_store_requires_identity_fields(): void
    {
        $this->auth()->postJson(self::BASE, [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['driver_code', 'full_name', 'mobile', 'national_id']);
    }

    public function test_store_rejects_expiry_before_issue(): void
    {
        $this->auth()->postJson(self::BASE, $this->payload([
            'license_issue_date' => '2026-05-01',
            'license_expiry_date' => '2026-01-01',
        ]))->assertStatus(422)->assertJsonValidationErrors('license_expiry_date');
    }

    public function test_store_rejects_future_date_of_birth(): void
    {
        $this->auth()->postJson(self::BASE, $this->payload([
            'date_of_birth' => Carbon::tomorrow()->toDateString(),
        ]))->assertStatus(422)->assertJsonValidationErrors('date_of_birth');
    }

    // ── Update / uniqueness ignores self ──────────────────────────────────────

    public function test_update_edits_driver(): void
    {
        $driver = $this->makeDriver();

        $this->auth()->putJson(self::BASE.'/'.$driver->id, ['full_name' => 'Mahmoud A. Ali'])
            ->assertOk()
            ->assertJsonPath('data.full_name', 'Mahmoud A. Ali');
    }

    public function test_update_allows_keeping_own_unique_values(): void
    {
        $driver = $this->makeDriver();

        $this->auth()->putJson(self::BASE.'/'.$driver->id, [
            'driver_code' => $driver->driver_code,
            'mobile' => $driver->mobile,
            'national_id' => $driver->national_id,
            'address' => 'New address',
        ])->assertOk()->assertJsonPath('data.address', 'New address');
    }

    public function test_update_rejects_another_drivers_mobile(): void
    {
        $this->makeDriver(['driver_code' => 'DRV-001', 'mobile' => '01000000001', 'national_id' => 'N1']);
        $second = $this->makeDriver(['driver_code' => 'DRV-002', 'mobile' => '01000000002', 'national_id' => 'N2']);

        $this->auth()->putJson(self::BASE.'/'.$second->id, ['mobile' => '01000000001'])
            ->assertStatus(422)->assertJsonValidationErrors('mobile');
    }

    // ── Lifecycle (BR-5) ──────────────────────────────────────────────────────

    public function test_status_transitions(): void
    {
        $driver = $this->makeDriver();

        $this->auth()->patchJson(self::BASE.'/'.$driver->id.'/status', ['status' => 'inactive'])
            ->assertOk()->assertJsonPath('data.status', 'inactive');

        $this->auth()->patchJson(self::BASE.'/'.$driver->id.'/status', ['status' => 'active'])
            ->assertOk()->assertJsonPath('data.status', 'active');

        $this->auth()->patchJson(self::BASE.'/'.$driver->id.'/status', ['status' => 'archived'])
            ->assertOk()->assertJsonPath('data.status', 'archived');
    }

    /** BR-4 + BR-5: the module exposes no delete route at all. */
    public function test_no_delete_endpoint_exists(): void
    {
        $driver = $this->makeDriver();

        $this->auth()->deleteJson(self::BASE.'/'.$driver->id)->assertStatus(405);
        $this->assertDatabaseHas('logistics_drivers', ['id' => $driver->id]);
    }

    public function test_archiving_releases_the_held_vehicle(): void
    {
        $driver = $this->makeDriver();
        $vehicle = $this->makeVehicle();
        app(DriverVehicleAssignmentService::class)->assign($driver, $vehicle);

        $this->auth()->patchJson(self::BASE.'/'.$driver->id.'/status', ['status' => 'archived'])
            ->assertOk();

        $this->assertNull($driver->fresh()->activeAssignment);
        // History is preserved.
        $this->assertSame(1, $driver->assignments()->count());
        // The vehicle is free again.
        $this->assertFalse($vehicle->fresh()->hasActiveDriver());
    }

    public function test_index_hides_archived_by_default(): void
    {
        $this->makeDriver(['driver_code' => 'DRV-001', 'mobile' => '01000000001', 'national_id' => 'N1']);
        $this->makeDriver(['driver_code' => 'DRV-002', 'mobile' => '01000000002', 'national_id' => 'N2', 'status' => 'archived']);

        $this->auth()->getJson(self::BASE)->assertOk()->assertJsonPath('meta.total', 1);
        $this->auth()->getJson(self::BASE.'?status=archived')->assertOk()->assertJsonPath('meta.total', 1);
        $this->auth()->getJson(self::BASE.'?status=all')->assertOk()->assertJsonPath('meta.total', 2);
    }

    // ── Search & filters ──────────────────────────────────────────────────────

    public function test_index_searches_across_identity_fields(): void
    {
        $this->makeDriver(['driver_code' => 'DRV-001', 'full_name' => 'Mahmoud Adel', 'mobile' => '01011112222', 'national_id' => 'AAA']);
        $this->makeDriver(['driver_code' => 'DRV-002', 'full_name' => 'Sara Nabil', 'mobile' => '01033334444', 'national_id' => 'BBB']);

        $this->auth()->getJson(self::BASE.'?search=Sara')->assertOk()->assertJsonPath('meta.total', 1);
        $this->auth()->getJson(self::BASE.'?search=01011112222')->assertOk()->assertJsonPath('meta.total', 1);
        $this->auth()->getJson(self::BASE.'?search=BBB')->assertOk()->assertJsonPath('meta.total', 1);
    }

    public function test_index_filters_by_license_status(): void
    {
        $this->makeDriver(['driver_code' => 'DRV-001', 'mobile' => '01000000001', 'national_id' => 'N1', 'license_expiry_date' => Carbon::today()->subDay()->toDateString()]);
        $this->makeDriver(['driver_code' => 'DRV-002', 'mobile' => '01000000002', 'national_id' => 'N2', 'license_expiry_date' => Carbon::today()->addDays(5)->toDateString()]);
        $this->makeDriver(['driver_code' => 'DRV-003', 'mobile' => '01000000003', 'national_id' => 'N3', 'license_expiry_date' => null, 'license_issue_date' => null]);

        $this->auth()->getJson(self::BASE.'?license_status=expired')->assertOk()->assertJsonPath('meta.total', 1);
        $this->auth()->getJson(self::BASE.'?license_status=expiring_soon')->assertOk()->assertJsonPath('meta.total', 1);
        $this->auth()->getJson(self::BASE.'?license_status=missing')->assertOk()->assertJsonPath('meta.total', 1);
    }

    public function test_index_filters_by_vehicle_assignment(): void
    {
        $assigned = $this->makeDriver(['driver_code' => 'DRV-001', 'mobile' => '01000000001', 'national_id' => 'N1']);
        $this->makeDriver(['driver_code' => 'DRV-002', 'mobile' => '01000000002', 'national_id' => 'N2']);
        app(DriverVehicleAssignmentService::class)->assign($assigned, $this->makeVehicle());

        $this->auth()->getJson(self::BASE.'?vehicle=assigned')->assertOk()->assertJsonPath('meta.total', 1);
        $this->auth()->getJson(self::BASE.'?vehicle=unassigned')->assertOk()->assertJsonPath('meta.total', 1);
    }

    // ── Licence derivation (BR-8) ─────────────────────────────────────────────

    public function test_license_status_is_derived(): void
    {
        $expired = $this->makeDriver(['driver_code' => 'DRV-001', 'mobile' => '01000000001', 'national_id' => 'N1', 'license_expiry_date' => Carbon::today()->subDays(3)->toDateString()]);
        $soon = $this->makeDriver(['driver_code' => 'DRV-002', 'mobile' => '01000000002', 'national_id' => 'N2', 'license_expiry_date' => Carbon::today()->addDays(7)->toDateString()]);
        $valid = $this->makeDriver(['driver_code' => 'DRV-003', 'mobile' => '01000000003', 'national_id' => 'N3', 'license_expiry_date' => Carbon::today()->addYear()->toDateString()]);
        $missing = $this->makeDriver(['driver_code' => 'DRV-004', 'mobile' => '01000000004', 'national_id' => 'N4', 'license_expiry_date' => null, 'license_issue_date' => null]);

        $this->assertSame(Driver::LICENSE_EXPIRED, $expired->licenseStatus());
        $this->assertSame(Driver::LICENSE_EXPIRING, $soon->licenseStatus());
        $this->assertSame(Driver::LICENSE_VALID, $valid->licenseStatus());
        $this->assertSame(Driver::LICENSE_MISSING, $missing->licenseStatus());
        $this->assertTrue($expired->hasExpiredLicense());
    }

    public function test_license_days_remaining_is_negative_once_expired(): void
    {
        $driver = $this->makeDriver(['license_expiry_date' => Carbon::today()->subDays(5)->toDateString()]);

        $this->assertSame(-5, $driver->licenseDaysRemaining());
    }

    /** BR-8 */
    public function test_expired_license_blocks_starting_deliveries(): void
    {
        $driver = $this->makeDriver(['license_expiry_date' => Carbon::today()->subDay()->toDateString()]);
        app(DriverVehicleAssignmentService::class)->assign($driver, $this->makeVehicle());

        $this->assertFalse($driver->fresh()->canStartDeliveries());
    }

    public function test_valid_license_plus_vehicle_allows_deliveries(): void
    {
        $driver = $this->makeDriver();
        app(DriverVehicleAssignmentService::class)->assign($driver, $this->makeVehicle());

        $this->assertTrue($driver->fresh()->canStartDeliveries());
    }

    public function test_driver_without_vehicle_cannot_start_deliveries(): void
    {
        $this->assertFalse($this->makeDriver()->canStartDeliveries());
    }

    public function test_inactive_driver_cannot_start_deliveries(): void
    {
        $driver = $this->makeDriver(['status' => 'inactive']);
        app(DriverVehicleAssignmentService::class)->assign(
            Driver::find($driver->id)->fill(['status' => 'active']),
            $this->makeVehicle()
        );

        $driver->update(['status' => 'inactive']);
        $this->assertFalse($driver->fresh()->canStartDeliveries());
    }

    // ── Vehicle assignment (BR-6, BR-7) ───────────────────────────────────────

    public function test_assign_vehicle(): void
    {
        $driver = $this->makeDriver();
        $vehicle = $this->makeVehicle();

        $this->auth()->postJson(self::BASE.'/'.$driver->id.'/vehicle', ['vehicle_id' => $vehicle->id])
            ->assertCreated()
            ->assertJsonPath('data.vehicle_id', $vehicle->id)
            ->assertJsonPath('data.is_active', true);

        $this->auth()->getJson(self::BASE.'/'.$driver->id)
            ->assertOk()
            ->assertJsonPath('data.current_vehicle.plate_number', 'ABC-1234')
            ->assertJsonPath('data.has_vehicle', true);
    }

    /**
     * Regression: an unassigned driver must report has_vehicle=false and
     * can_start_deliveries=false — not null. whenLoaded() collapses empty
     * relations to null, which would mislead the Distribution module.
     */
    public function test_unassigned_driver_reports_false_not_null(): void
    {
        $driver = $this->makeDriver();

        $response = $this->auth()->getJson(self::BASE.'/'.$driver->id)->assertOk();

        $this->assertNull($response->json('data.current_vehicle'));
        $this->assertFalse($response->json('data.has_vehicle'));
        $this->assertFalse($response->json('data.can_start_deliveries'));
        $this->assertSame(false, $response->json('data.has_vehicle'));
    }

    // The vehicle-side equivalent of this assertion moved to VehicleModuleTest
    // when TASK-LOG-003 took ownership of the vehicle aggregate.

    public function test_archiving_reports_vehicle_released_in_payload(): void
    {
        $driver = $this->makeDriver();
        app(DriverVehicleAssignmentService::class)->assign($driver, $this->makeVehicle());

        $this->auth()->patchJson(self::BASE.'/'.$driver->id.'/status', ['status' => 'archived'])->assertOk();

        $this->auth()->getJson(self::BASE.'/'.$driver->id)
            ->assertOk()
            ->assertJsonPath('data.current_vehicle', null)
            ->assertJsonPath('data.has_vehicle', false);
    }

    /** BR-6 — changing vehicles releases the old pairing atomically. */
    public function test_changing_vehicle_releases_previous_and_keeps_one_active(): void
    {
        $driver = $this->makeDriver();
        $first = $this->makeVehicle(['plate_number' => 'AAA-111']);
        $second = $this->makeVehicle(['plate_number' => 'BBB-222']);

        $this->auth()->postJson(self::BASE.'/'.$driver->id.'/vehicle', ['vehicle_id' => $first->id])->assertCreated();
        $this->auth()->postJson(self::BASE.'/'.$driver->id.'/vehicle', ['vehicle_id' => $second->id])->assertCreated();

        $this->assertSame(1, $driver->assignments()->whereNotNull('active_flag')->count());
        $this->assertSame($second->id, $driver->fresh()->activeAssignment->vehicle_id);
        // History preserved — both pairings survive.
        $this->assertSame(2, $driver->assignments()->count());
        $this->assertFalse($first->fresh()->hasActiveDriver());
    }

    /** BR-7 */
    public function test_vehicle_cannot_be_assigned_to_two_drivers(): void
    {
        $first = $this->makeDriver(['driver_code' => 'DRV-001', 'mobile' => '01000000001', 'national_id' => 'N1']);
        $second = $this->makeDriver(['driver_code' => 'DRV-002', 'mobile' => '01000000002', 'national_id' => 'N2']);
        $vehicle = $this->makeVehicle();

        $this->auth()->postJson(self::BASE.'/'.$first->id.'/vehicle', ['vehicle_id' => $vehicle->id])->assertCreated();

        $this->auth()->postJson(self::BASE.'/'.$second->id.'/vehicle', ['vehicle_id' => $vehicle->id])
            ->assertStatus(422)
            ->assertJsonPath('message', "Vehicle ABC-1234 is already assigned to {$first->full_name}. Release it first.");

        $this->assertSame(1, $vehicle->assignments()->whereNotNull('active_flag')->count());
    }

    public function test_reassigning_the_same_vehicle_is_rejected(): void
    {
        $driver = $this->makeDriver();
        $vehicle = $this->makeVehicle();

        $this->auth()->postJson(self::BASE.'/'.$driver->id.'/vehicle', ['vehicle_id' => $vehicle->id])->assertCreated();
        $this->auth()->postJson(self::BASE.'/'.$driver->id.'/vehicle', ['vehicle_id' => $vehicle->id])
            ->assertStatus(422);
    }

    public function test_archived_driver_cannot_be_assigned_a_vehicle(): void
    {
        $driver = $this->makeDriver(['status' => 'archived']);
        $vehicle = $this->makeVehicle();

        $this->auth()->postJson(self::BASE.'/'.$driver->id.'/vehicle', ['vehicle_id' => $vehicle->id])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Archived drivers cannot be assigned a vehicle.');
    }

    public function test_vehicle_not_in_the_pool_cannot_be_assigned(): void
    {
        $driver = $this->makeDriver();

        foreach (['maintenance', 'out_of_service', 'archived'] as $i => $status) {
            $vehicle = $this->makeVehicle(['plate_number' => "OFF-{$i}", 'status' => $status]);

            $this->auth()->postJson(self::BASE.'/'.$driver->id.'/vehicle', ['vehicle_id' => $vehicle->id])
                ->assertStatus(422);
        }
    }

    /** Assigning a driver moves the vehicle Available → Assigned. */
    public function test_assignment_marks_the_vehicle_assigned(): void
    {
        $driver = $this->makeDriver();
        $vehicle = $this->makeVehicle();

        $this->auth()->postJson(self::BASE.'/'.$driver->id.'/vehicle', ['vehicle_id' => $vehicle->id])
            ->assertCreated();

        $this->assertSame('assigned', $vehicle->fresh()->status->value);

        $this->auth()->deleteJson(self::BASE.'/'.$driver->id.'/vehicle')->assertOk();

        $this->assertSame('available', $vehicle->fresh()->status->value);
    }

    public function test_release_vehicle(): void
    {
        $driver = $this->makeDriver();
        $vehicle = $this->makeVehicle();
        $this->auth()->postJson(self::BASE.'/'.$driver->id.'/vehicle', ['vehicle_id' => $vehicle->id])->assertCreated();

        $this->auth()->deleteJson(self::BASE.'/'.$driver->id.'/vehicle', ['reason' => 'Shift ended'])
            ->assertOk()
            ->assertJsonPath('data.is_active', false)
            ->assertJsonPath('data.release_reason', 'Shift ended');

        $this->assertNull($driver->fresh()->activeAssignment);
        $this->assertSame(1, $driver->assignments()->count());
    }

    public function test_release_without_assignment_is_rejected(): void
    {
        $driver = $this->makeDriver();

        $this->auth()->deleteJson(self::BASE.'/'.$driver->id.'/vehicle')
            ->assertStatus(422)
            ->assertJsonPath('message', 'This driver has no active vehicle assignment to release.');
    }

    public function test_assignment_history_is_ordered_and_complete(): void
    {
        $driver = $this->makeDriver();
        $a = $this->makeVehicle(['plate_number' => 'AAA-111']);
        $b = $this->makeVehicle(['plate_number' => 'BBB-222']);

        $this->auth()->postJson(self::BASE.'/'.$driver->id.'/vehicle', ['vehicle_id' => $a->id])->assertCreated();
        $this->auth()->postJson(self::BASE.'/'.$driver->id.'/vehicle', ['vehicle_id' => $b->id])->assertCreated();
        $this->auth()->deleteJson(self::BASE.'/'.$driver->id.'/vehicle')->assertOk();

        $this->auth()->getJson(self::BASE.'/'.$driver->id.'/assignments')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->assertSame(0, $driver->assignments()->whereNotNull('active_flag')->count());
    }

    public function test_released_vehicle_can_be_reassigned_to_another_driver(): void
    {
        $first = $this->makeDriver(['driver_code' => 'DRV-001', 'mobile' => '01000000001', 'national_id' => 'N1']);
        $second = $this->makeDriver(['driver_code' => 'DRV-002', 'mobile' => '01000000002', 'national_id' => 'N2']);
        $vehicle = $this->makeVehicle();

        $this->auth()->postJson(self::BASE.'/'.$first->id.'/vehicle', ['vehicle_id' => $vehicle->id])->assertCreated();
        $this->auth()->deleteJson(self::BASE.'/'.$first->id.'/vehicle')->assertOk();
        $this->auth()->postJson(self::BASE.'/'.$second->id.'/vehicle', ['vehicle_id' => $vehicle->id])->assertCreated();

        $this->assertSame($second->id, $vehicle->fresh()->activeAssignment->driver_id);
        $this->assertSame(2, $vehicle->assignments()->count());
    }

    // ── Documents ─────────────────────────────────────────────────────────────

    public function test_upload_document(): void
    {
        Storage::fake('local');
        $driver = $this->makeDriver();

        $this->auth()->postJson(self::BASE.'/'.$driver->id.'/documents', [
            'file' => UploadedFile::fake()->create('licence.pdf', 120, 'application/pdf'),
            'type' => DriverDocument::TYPE_LICENSE,
            'title' => 'Driving licence 2026',
            'expires_at' => '2030-01-01',
        ])
            ->assertCreated()
            ->assertJsonPath('data.type', 'license')
            ->assertJsonPath('data.file_name', 'licence.pdf')
            ->assertJsonPath('data.is_expired', false);

        $this->assertSame(1, $driver->documents()->count());
    }

    public function test_document_type_must_be_known(): void
    {
        Storage::fake('local');
        $driver = $this->makeDriver();

        $this->auth()->postJson(self::BASE.'/'.$driver->id.'/documents', [
            'file' => UploadedFile::fake()->create('x.pdf', 10, 'application/pdf'),
            'type' => 'passport',
        ])->assertStatus(422)->assertJsonValidationErrors('type');
    }

    public function test_document_rejects_disallowed_mime(): void
    {
        Storage::fake('local');
        $driver = $this->makeDriver();

        $this->auth()->postJson(self::BASE.'/'.$driver->id.'/documents', [
            'file' => UploadedFile::fake()->create('malware.exe', 10),
            'type' => DriverDocument::TYPE_OTHER,
        ])->assertStatus(422)->assertJsonValidationErrors('file');
    }

    public function test_document_file_path_is_not_exposed(): void
    {
        Storage::fake('local');
        $driver = $this->makeDriver();

        $response = $this->auth()->postJson(self::BASE.'/'.$driver->id.'/documents', [
            'file' => UploadedFile::fake()->create('id.pdf', 10, 'application/pdf'),
            'type' => DriverDocument::TYPE_NATIONAL_ID,
        ])->assertCreated();

        $this->assertArrayNotHasKey('file_path', $response->json('data'));
        $this->assertStringContainsString('/download', $response->json('data.download_url'));
    }

    public function test_expired_document_is_flagged(): void
    {
        Storage::fake('local');
        $driver = $this->makeDriver();

        $this->auth()->postJson(self::BASE.'/'.$driver->id.'/documents', [
            'file' => UploadedFile::fake()->create('old.pdf', 10, 'application/pdf'),
            'type' => DriverDocument::TYPE_MEDICAL_CERTIFICATE,
            'expires_at' => Carbon::today()->subMonth()->toDateString(),
        ])->assertCreated()->assertJsonPath('data.is_expired', true);
    }

    public function test_download_document(): void
    {
        Storage::fake('local');
        $driver = $this->makeDriver();

        $id = $this->auth()->postJson(self::BASE.'/'.$driver->id.'/documents', [
            'file' => UploadedFile::fake()->create('contract.pdf', 10, 'application/pdf'),
            'type' => DriverDocument::TYPE_EMPLOYMENT_CONTRACT,
        ])->json('data.id');

        $this->auth()->get(self::BASE.'/'.$driver->id.'/documents/'.$id.'/download')
            ->assertOk()
            ->assertDownload('contract.pdf');
    }

    public function test_delete_document_removes_row_and_file(): void
    {
        Storage::fake('local');
        $driver = $this->makeDriver();

        $doc = $this->auth()->postJson(self::BASE.'/'.$driver->id.'/documents', [
            'file' => UploadedFile::fake()->create('tmp.pdf', 10, 'application/pdf'),
            'type' => DriverDocument::TYPE_OTHER,
        ])->json('data');

        $path = DriverDocument::find($doc['id'])->file_path;
        Storage::disk('local')->assertExists($path);

        $this->auth()->deleteJson(self::BASE.'/'.$driver->id.'/documents/'.$doc['id'])->assertNoContent();

        Storage::disk('local')->assertMissing($path);
        $this->assertSame(0, $driver->documents()->count());
    }

    public function test_archived_driver_cannot_receive_documents(): void
    {
        Storage::fake('local');
        $driver = $this->makeDriver(['status' => 'archived']);

        $this->auth()->postJson(self::BASE.'/'.$driver->id.'/documents', [
            'file' => UploadedFile::fake()->create('x.pdf', 10, 'application/pdf'),
            'type' => DriverDocument::TYPE_OTHER,
        ])->assertStatus(422);
    }

    public function test_document_of_another_driver_is_not_reachable(): void
    {
        Storage::fake('local');
        $a = $this->makeDriver(['driver_code' => 'DRV-001', 'mobile' => '01000000001', 'national_id' => 'N1']);
        $b = $this->makeDriver(['driver_code' => 'DRV-002', 'mobile' => '01000000002', 'national_id' => 'N2']);

        $id = $this->auth()->postJson(self::BASE.'/'.$b->id.'/documents', [
            'file' => UploadedFile::fake()->create('b.pdf', 10, 'application/pdf'),
            'type' => DriverDocument::TYPE_OTHER,
        ])->json('data.id');

        $this->auth()->deleteJson(self::BASE.'/'.$a->id.'/documents/'.$id)->assertNotFound();
    }

    // ── Vehicle registry ──────────────────────────────────────────────────────
    //
    // The minimal registry seeded here by TASK-LOG-002 was promoted to a full
    // aggregate by TASK-LOG-003. Its CRUD, uniqueness and availability-filter
    // coverage now lives in VehicleModuleTest, which owns that contract.
    // What remains below is the driver-side view of the pairing.

    public function test_assigning_from_the_driver_side_engages_the_vehicle(): void
    {
        $free = $this->makeVehicle(['plate_number' => 'FREE-1']);
        $taken = $this->makeVehicle(['plate_number' => 'TAKEN-1']);
        app(DriverVehicleAssignmentService::class)->assign($this->makeDriver(), $taken);

        $plates = array_column(
            $this->auth()->getJson(self::VEHICLES.'?available=1')->assertOk()->json('data'),
            'plate_number',
        );

        $this->assertContains('FREE-1', $plates);
        $this->assertNotContains('TAKEN-1', $plates);
        $this->assertSame($free->plate_number, $plates[0]);
    }

    // ── Security ──────────────────────────────────────────────────────────────

    public function test_routes_require_authentication(): void
    {
        $driver = $this->makeDriver();

        $this->getJson(self::BASE)->assertUnauthorized();
        $this->getJson(self::BASE.'/stats')->assertUnauthorized();
        $this->getJson(self::BASE.'/'.$driver->id)->assertUnauthorized();
        $this->postJson(self::BASE, $this->payload(['driver_code' => 'DRV-X']))->assertUnauthorized();
        $this->patchJson(self::BASE.'/'.$driver->id.'/status', ['status' => 'archived'])->assertUnauthorized();
        $this->postJson(self::BASE.'/'.$driver->id.'/vehicle', ['vehicle_id' => 1])->assertUnauthorized();
        $this->getJson(self::BASE.'/'.$driver->id.'/assignments')->assertUnauthorized();
        $this->getJson(self::VEHICLES)->assertUnauthorized();
    }
}
