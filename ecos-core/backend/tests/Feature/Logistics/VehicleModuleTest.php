<?php

declare(strict_types=1);

namespace Tests\Feature\Logistics;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Modules\Logistics\Drivers\Domain\Models\Driver;
use Modules\Logistics\Drivers\Domain\Services\DriverVehicleAssignmentService;
use Modules\Logistics\Vehicles\Domain\Enums\VehicleDocumentType;
use Modules\Logistics\Vehicles\Domain\Enums\VehicleStatus;
use Modules\Logistics\Vehicles\Domain\Enums\VehicleType;
use Modules\Logistics\Vehicles\Domain\Events\VehicleCreated;
use Modules\Logistics\Vehicles\Domain\Events\VehicleMaintenanceRecorded;
use Modules\Logistics\Vehicles\Domain\Events\VehicleStatusChanged;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;
use Modules\Logistics\Vehicles\Domain\Services\VehicleMaintenanceService;
use Tests\TestCase;

/**
 * TASK-LOG-003 — Vehicles Module
 *
 * Business rules under test:
 *   BR-1 vehicle_code unique
 *   BR-2 plate_number unique
 *   BR-3 archived vehicles receive no assignments
 *   BR-4 status transitions are validated; Available is refused while a driver is held
 *   BR-5 one active driver assignment per vehicle
 *   BR-6 capacity values must be greater than zero
 *   BR-7 expired licence or insurance blocks dispatch
 *   BR-8 maintenance records are immutable without the manage permission
 */
class VehicleModuleTest extends TestCase
{
    use DatabaseTransactions;

    private const BASE = '/api/logistics/vehicles';

    private const DRIVERS = '/api/logistics/drivers';

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
            'vehicle_code' => 'VEH-001',
            'plate_number' => 'ABC-1234',
            'name' => 'Cairo Van 1',
            'type' => VehicleType::Van->value,
            'capacity_orders' => 60,
            'capacity_weight_kg' => 1200.5,
            'capacity_volume_m3' => 8.25,
            'fuel_type' => 'diesel',
            'manufacturer' => 'Toyota',
            'model' => 'Hiace',
            'year' => 2022,
            'color' => 'White',
        ], $overrides);
    }

    private function makeVehicle(array $overrides = []): Vehicle
    {
        return Vehicle::create(array_merge($this->payload(), $overrides));
    }

    private function makeDriver(array $overrides = []): Driver
    {
        return Driver::create(array_merge([
            'driver_code' => 'DRV-900',
            'full_name' => 'Fleet Driver',
            'mobile' => '01099000900',
            'national_id' => 'NID-900',
            'license_expiry_date' => '2030-01-01',
        ], $overrides));
    }

    // ── Reference data ────────────────────────────────────────────────────────

    public function test_options_expose_all_enum_vocabularies(): void
    {
        $response = $this->auth()->getJson(self::BASE.'/options')->assertOk();

        $this->assertCount(7, $response->json('types'));
        $this->assertCount(6, $response->json('statuses'));
        $this->assertCount(4, $response->json('operator_settable_statuses'));
        $this->assertSame('motorcycle', $response->json('types.0.value'));
        $this->assertSame('large_truck', $response->json('types.6.value'));
        $this->assertCount(4, $response->json('document_types'));
    }

    public function test_next_code_is_sequential(): void
    {
        $this->auth()->getJson(self::BASE.'/next-code')->assertOk()->assertJson(['code' => 'VEH-001']);

        $this->makeVehicle(['vehicle_code' => 'VEH-001']);
        $this->makeVehicle(['vehicle_code' => 'VEH-002', 'plate_number' => 'B-2']);

        $this->auth()->getJson(self::BASE.'/next-code')->assertOk()->assertJson(['code' => 'VEH-003']);
    }

    // ── Dashboard ─────────────────────────────────────────────────────────────

    public function test_stats_returns_dashboard_counters(): void
    {
        $this->makeVehicle(['vehicle_code' => 'V1', 'plate_number' => 'P1', 'status' => 'available']);
        $this->makeVehicle(['vehicle_code' => 'V2', 'plate_number' => 'P2', 'status' => 'maintenance']);
        $this->makeVehicle(['vehicle_code' => 'V3', 'plate_number' => 'P3', 'status' => 'out_of_service']);
        $this->makeVehicle(['vehicle_code' => 'V4', 'plate_number' => 'P4', 'status' => 'archived']);

        $this->auth()->getJson(self::BASE.'/stats')
            ->assertOk()
            ->assertJson([
                'total_vehicles' => 4,
                'available' => 1,
                'assigned' => 0,
                'maintenance' => 1,
                'out_of_service' => 1,
                'archived' => 1,
            ]);
    }

    public function test_stats_counts_expiring_and_expired_licences(): void
    {
        Storage::fake('local');
        $expiring = $this->makeVehicle(['vehicle_code' => 'V1', 'plate_number' => 'P1']);
        $expired = $this->makeVehicle(['vehicle_code' => 'V2', 'plate_number' => 'P2']);

        $this->uploadDocument($expiring, VehicleDocumentType::License, Carbon::today()->addDays(10));
        $this->uploadDocument($expired, VehicleDocumentType::Insurance, Carbon::today()->subDay());

        $this->auth()->getJson(self::BASE.'/stats')
            ->assertOk()
            ->assertJsonPath('expiring_licenses', 1)
            ->assertJsonPath('expired_licenses', 1);
    }

    // ── Create / uniqueness (BR-1, BR-2) ──────────────────────────────────────

    public function test_store_creates_vehicle(): void
    {
        $this->auth()->postJson(self::BASE, $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.vehicle_code', 'VEH-001')
            ->assertJsonPath('data.plate_number', 'ABC-1234')
            ->assertJsonPath('data.status', 'available')
            ->assertJsonPath('data.type_label', 'Van')
            ->assertJsonPath('data.fuel_type_label', 'Diesel');

        $this->assertDatabaseHas('logistics_vehicles', ['vehicle_code' => 'VEH-001']);
    }

    public function test_store_generates_uuid(): void
    {
        $uuid = $this->auth()->postJson(self::BASE, $this->payload())
            ->assertCreated()
            ->json('data.uuid');

        $this->assertNotNull($uuid);
        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i',
            $uuid,
        );
    }

    /** BR-1 */
    public function test_vehicle_code_must_be_unique(): void
    {
        $this->makeVehicle(['vehicle_code' => 'VEH-001']);

        $this->auth()->postJson(self::BASE, $this->payload(['vehicle_code' => 'VEH-001', 'plate_number' => 'OTHER']))
            ->assertStatus(422)->assertJsonValidationErrors('vehicle_code');
    }

    /** BR-2 */
    public function test_plate_number_must_be_unique(): void
    {
        $this->makeVehicle(['plate_number' => 'ABC-1234']);

        $this->auth()->postJson(self::BASE, $this->payload(['vehicle_code' => 'VEH-999', 'plate_number' => 'ABC-1234']))
            ->assertStatus(422)->assertJsonValidationErrors('plate_number');
    }

    public function test_store_requires_core_fields(): void
    {
        $this->auth()->postJson(self::BASE, [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['vehicle_code', 'plate_number', 'type', 'capacity_orders']);
    }

    public function test_store_rejects_unknown_type(): void
    {
        $this->auth()->postJson(self::BASE, $this->payload(['type' => 'spaceship']))
            ->assertStatus(422)->assertJsonValidationErrors('type');
    }

    /** BR-6 */
    public function test_capacities_must_be_greater_than_zero(): void
    {
        $this->auth()->postJson(self::BASE, $this->payload(['capacity_orders' => 0]))
            ->assertStatus(422)->assertJsonValidationErrors('capacity_orders');

        $this->auth()->postJson(self::BASE, $this->payload(['capacity_weight_kg' => 0]))
            ->assertStatus(422)->assertJsonValidationErrors('capacity_weight_kg');

        $this->auth()->postJson(self::BASE, $this->payload(['capacity_volume_m3' => -1]))
            ->assertStatus(422)->assertJsonValidationErrors('capacity_volume_m3');
    }

    public function test_update_edits_vehicle(): void
    {
        $vehicle = $this->makeVehicle();

        $this->auth()->putJson(self::BASE.'/'.$vehicle->id, ['name' => 'Cairo Van 1A', 'color' => 'Blue'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Cairo Van 1A')
            ->assertJsonPath('data.color', 'Blue');
    }

    /** Status may only move through the dedicated endpoint. */
    public function test_update_cannot_change_status(): void
    {
        $vehicle = $this->makeVehicle(['status' => 'available']);

        $this->auth()->putJson(self::BASE.'/'.$vehicle->id, ['status' => 'archived'])->assertOk();

        $this->assertSame('available', $vehicle->fresh()->status->value);
    }

    // ── Status transitions (BR-4) ─────────────────────────────────────────────

    public function test_valid_transitions_are_accepted(): void
    {
        $vehicle = $this->makeVehicle(['status' => 'available']);

        $this->auth()->patchJson(self::BASE.'/'.$vehicle->id.'/status', ['status' => 'maintenance'])
            ->assertOk()->assertJsonPath('data.status', 'maintenance');

        $this->auth()->patchJson(self::BASE.'/'.$vehicle->id.'/status', ['status' => 'available'])
            ->assertOk()->assertJsonPath('data.status', 'available');
    }

    /** BR-4 — out of service must return through maintenance, never straight to available. */
    public function test_out_of_service_cannot_jump_to_available(): void
    {
        $vehicle = $this->makeVehicle(['status' => 'out_of_service']);

        $this->auth()->patchJson(self::BASE.'/'.$vehicle->id.'/status', ['status' => 'available'])
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'cannot move from Out of Service to Available'));

        $this->assertSame('out_of_service', $vehicle->fresh()->status->value);
    }

    public function test_archived_restores_only_to_out_of_service(): void
    {
        $vehicle = $this->makeVehicle(['status' => 'archived']);

        $this->auth()->patchJson(self::BASE.'/'.$vehicle->id.'/status', ['status' => 'available'])
            ->assertStatus(422);

        $this->auth()->patchJson(self::BASE.'/'.$vehicle->id.'/status', ['status' => 'out_of_service'])
            ->assertOk()->assertJsonPath('data.status', 'out_of_service');
    }

    public function test_derived_statuses_cannot_be_set_directly(): void
    {
        $vehicle = $this->makeVehicle();

        foreach (['assigned', 'in_delivery'] as $derived) {
            $this->auth()->patchJson(self::BASE.'/'.$vehicle->id.'/status', ['status' => $derived])
                ->assertStatus(422)
                ->assertJsonPath('message', fn (string $m) => str_contains($m, 'cannot be set directly'));
        }
    }

    /** BR-4 — a vehicle still holding a driver may not be declared Available. */
    public function test_cannot_become_available_while_driver_assigned(): void
    {
        $vehicle = $this->makeVehicle();
        $driver = $this->makeDriver();
        app(DriverVehicleAssignmentService::class)->assign($driver, $vehicle);

        $this->assertSame('assigned', $vehicle->fresh()->status->value);

        $this->auth()->patchJson(self::BASE.'/'.$vehicle->id.'/status', ['status' => 'available'])
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'active driver assignment'));
    }

    public function test_status_rejects_unknown_value(): void
    {
        $vehicle = $this->makeVehicle();

        $this->auth()->patchJson(self::BASE.'/'.$vehicle->id.'/status', ['status' => 'exploded'])
            ->assertStatus(422)->assertJsonValidationErrors('status');
    }

    public function test_resource_advertises_allowed_transitions(): void
    {
        $vehicle = $this->makeVehicle(['status' => 'out_of_service']);

        $next = $this->auth()->getJson(self::BASE.'/'.$vehicle->id)
            ->assertOk()
            ->json('data.allowed_transitions');

        $this->assertSame(['maintenance', 'archived'], array_column($next, 'value'));
    }

    // ── Driver assignment integration (BR-3, BR-5) ────────────────────────────

    public function test_assignment_flows_through_the_drivers_module(): void
    {
        $vehicle = $this->makeVehicle();
        $driver = $this->makeDriver();

        $this->auth()->postJson(self::DRIVERS.'/'.$driver->id.'/vehicle', ['vehicle_id' => $vehicle->id])
            ->assertCreated();

        $this->auth()->getJson(self::BASE.'/'.$vehicle->id)
            ->assertOk()
            ->assertJsonPath('data.has_driver', true)
            ->assertJsonPath('data.current_driver.full_name', 'Fleet Driver')
            ->assertJsonPath('data.status', 'assigned');
    }

    /** BR-5 */
    public function test_only_one_active_driver_per_vehicle(): void
    {
        $vehicle = $this->makeVehicle();
        $first = $this->makeDriver(['driver_code' => 'D1', 'mobile' => '0101', 'national_id' => 'N1']);
        $second = $this->makeDriver(['driver_code' => 'D2', 'mobile' => '0102', 'national_id' => 'N2']);

        $this->auth()->postJson(self::DRIVERS.'/'.$first->id.'/vehicle', ['vehicle_id' => $vehicle->id])
            ->assertCreated();
        $this->auth()->postJson(self::DRIVERS.'/'.$second->id.'/vehicle', ['vehicle_id' => $vehicle->id])
            ->assertStatus(422);

        $this->assertSame(1, $vehicle->assignments()->whereNotNull('active_flag')->count());
    }

    /** BR-3 */
    public function test_archived_vehicle_cannot_receive_assignment(): void
    {
        $vehicle = $this->makeVehicle(['status' => 'archived']);
        $driver = $this->makeDriver();

        $this->auth()->postJson(self::DRIVERS.'/'.$driver->id.'/vehicle', ['vehicle_id' => $vehicle->id])
            ->assertStatus(422);
    }

    public function test_releasing_driver_returns_vehicle_to_the_pool(): void
    {
        $vehicle = $this->makeVehicle();
        $driver = $this->makeDriver();

        $this->auth()->postJson(self::DRIVERS.'/'.$driver->id.'/vehicle', ['vehicle_id' => $vehicle->id])->assertCreated();
        $this->auth()->deleteJson(self::DRIVERS.'/'.$driver->id.'/vehicle')->assertOk();

        $this->assertSame('available', $vehicle->fresh()->status->value);
        $this->assertFalse($vehicle->fresh()->hasActiveDriver());
    }

    public function test_available_filter_excludes_engaged_vehicles(): void
    {
        $free = $this->makeVehicle(['vehicle_code' => 'V1', 'plate_number' => 'FREE-1']);
        $taken = $this->makeVehicle(['vehicle_code' => 'V2', 'plate_number' => 'TAKEN-1']);
        app(DriverVehicleAssignmentService::class)->assign($this->makeDriver(), $taken);

        $plates = array_column(
            $this->auth()->getJson(self::BASE.'?available=1')->assertOk()->json('data'),
            'plate_number',
        );

        $this->assertContains('FREE-1', $plates);
        $this->assertNotContains('TAKEN-1', $plates);
        $this->assertSame($free->plate_number, $plates[0]);
    }

    // ── Documents (BR-7) ──────────────────────────────────────────────────────

    private function uploadDocument(Vehicle $vehicle, VehicleDocumentType $type, ?Carbon $expiresAt = null): array
    {
        return $this->auth()->postJson(self::BASE.'/'.$vehicle->id.'/documents', [
            'file' => UploadedFile::fake()->create('doc.pdf', 20, 'application/pdf'),
            'type' => $type->value,
            'expires_at' => $expiresAt?->toDateString(),
        ])->assertCreated()->json('data');
    }

    public function test_upload_document(): void
    {
        Storage::fake('local');
        $vehicle = $this->makeVehicle();

        $doc = $this->uploadDocument($vehicle, VehicleDocumentType::License, Carbon::today()->addYear());

        $this->assertSame('license', $doc['type']);
        $this->assertSame('Vehicle Licence', $doc['type_label']);
        $this->assertTrue($doc['blocks_dispatch']);
        $this->assertFalse($doc['is_expired']);
        $this->assertArrayNotHasKey('file_path', $doc);
    }

    public function test_document_rejects_disallowed_mime(): void
    {
        Storage::fake('local');
        $vehicle = $this->makeVehicle();

        $this->auth()->postJson(self::BASE.'/'.$vehicle->id.'/documents', [
            'file' => UploadedFile::fake()->create('bad.exe', 10),
            'type' => 'license',
        ])->assertStatus(422)->assertJsonValidationErrors('file');
    }

    public function test_expiring_document_is_flagged(): void
    {
        Storage::fake('local');
        $vehicle = $this->makeVehicle();

        $doc = $this->uploadDocument($vehicle, VehicleDocumentType::Insurance, Carbon::today()->addDays(10));

        $this->assertTrue($doc['is_expiring_soon']);
        $this->assertFalse($doc['is_expired']);
        $this->assertSame(10, $doc['days_until_expiry']);
    }

    /** BR-7 */
    public function test_expired_licence_blocks_dispatch(): void
    {
        Storage::fake('local');
        $vehicle = $this->makeVehicle();
        $this->uploadDocument($vehicle, VehicleDocumentType::License, Carbon::today()->subDay());

        $payload = $this->auth()->getJson(self::BASE.'/'.$vehicle->id)->assertOk()->json('data');

        $this->assertFalse($payload['can_be_dispatched']);
        $this->assertCount(1, $payload['blocking_expired_documents']);
        $this->assertSame('license', $payload['blocking_expired_documents'][0]['type']);
    }

    /** BR-7 */
    public function test_expired_insurance_blocks_dispatch(): void
    {
        Storage::fake('local');
        $vehicle = $this->makeVehicle();
        $this->uploadDocument($vehicle, VehicleDocumentType::Insurance, Carbon::today()->subDays(5));

        $this->assertFalse($vehicle->fresh()->canBeDispatched());
    }

    /** Inspection expiry is informational and must NOT block dispatch. */
    public function test_expired_inspection_does_not_block_dispatch(): void
    {
        Storage::fake('local');
        $vehicle = $this->makeVehicle();
        $this->uploadDocument($vehicle, VehicleDocumentType::Inspection, Carbon::today()->subDays(5));

        $this->assertTrue($vehicle->fresh()->canBeDispatched());
    }

    public function test_vehicle_with_current_documents_can_be_dispatched(): void
    {
        Storage::fake('local');
        $vehicle = $this->makeVehicle();
        $this->uploadDocument($vehicle, VehicleDocumentType::License, Carbon::today()->addYear());
        $this->uploadDocument($vehicle, VehicleDocumentType::Insurance, Carbon::today()->addMonths(6));

        $this->assertTrue($vehicle->fresh()->canBeDispatched());
    }

    public function test_out_of_service_vehicle_cannot_be_dispatched(): void
    {
        $vehicle = $this->makeVehicle(['status' => 'out_of_service']);

        $this->assertFalse($vehicle->fresh()->canBeDispatched());
    }

    public function test_download_and_delete_document(): void
    {
        Storage::fake('local');
        $vehicle = $this->makeVehicle();
        $doc = $this->uploadDocument($vehicle, VehicleDocumentType::Other);

        $this->auth()->get(self::BASE.'/'.$vehicle->id.'/documents/'.$doc['id'].'/download')
            ->assertOk()->assertDownload('doc.pdf');

        $this->auth()->deleteJson(self::BASE.'/'.$vehicle->id.'/documents/'.$doc['id'])->assertNoContent();
        $this->assertSame(0, $vehicle->documents()->count());
    }

    public function test_archived_vehicle_cannot_receive_documents(): void
    {
        Storage::fake('local');
        $vehicle = $this->makeVehicle(['status' => 'archived']);

        $this->auth()->postJson(self::BASE.'/'.$vehicle->id.'/documents', [
            'file' => UploadedFile::fake()->create('x.pdf', 10, 'application/pdf'),
            'type' => 'license',
        ])->assertStatus(422);
    }

    // ── Maintenance (BR-8) ────────────────────────────────────────────────────

    public function test_record_maintenance(): void
    {
        $vehicle = $this->makeVehicle();

        $this->auth()->postJson(self::BASE.'/'.$vehicle->id.'/maintenance', [
            'performed_on' => Carbon::today()->subDays(3)->toDateString(),
            'type' => 'oil_change',
            'description' => 'Full synthetic oil and filter',
            'cost' => 1450.75,
            'vendor' => 'Cairo Auto Care',
            'next_maintenance_date' => Carbon::today()->addMonths(6)->toDateString(),
        ])
            ->assertCreated()
            ->assertJsonPath('data.type', 'oil_change')
            ->assertJsonPath('data.type_label', 'Oil Change')
            ->assertJsonPath('data.cost', 1450.75)
            ->assertJsonPath('data.vendor', 'Cairo Auto Care')
            ->assertJsonPath('data.was_amended', false);

        $this->assertSame(1, $vehicle->maintenanceRecords()->count());
    }

    public function test_maintenance_history_is_returned_newest_first(): void
    {
        $vehicle = $this->makeVehicle();

        foreach ([10, 2, 30] as $daysAgo) {
            $this->auth()->postJson(self::BASE.'/'.$vehicle->id.'/maintenance', [
                'performed_on' => Carbon::today()->subDays($daysAgo)->toDateString(),
                'type' => 'routine',
            ])->assertCreated();
        }

        $dates = array_column(
            $this->auth()->getJson(self::BASE.'/'.$vehicle->id.'/maintenance')->assertOk()->json('data'),
            'performed_on',
        );

        $sorted = $dates;
        rsort($sorted);
        $this->assertSame($sorted, $dates);
    }

    public function test_maintenance_rejects_future_date_and_bad_next_date(): void
    {
        $vehicle = $this->makeVehicle();

        $this->auth()->postJson(self::BASE.'/'.$vehicle->id.'/maintenance', [
            'performed_on' => Carbon::tomorrow()->toDateString(),
            'type' => 'routine',
        ])->assertStatus(422)->assertJsonValidationErrors('performed_on');

        $this->auth()->postJson(self::BASE.'/'.$vehicle->id.'/maintenance', [
            'performed_on' => Carbon::today()->toDateString(),
            'type' => 'routine',
            'next_maintenance_date' => Carbon::today()->subDay()->toDateString(),
        ])->assertStatus(422)->assertJsonValidationErrors('next_maintenance_date');
    }

    /** BR-8 — a user without the permission cannot amend or delete. */
    public function test_maintenance_is_immutable_without_permission(): void
    {
        $vehicle = $this->makeVehicle();
        $id = $this->auth()->postJson(self::BASE.'/'.$vehicle->id.'/maintenance', [
            'performed_on' => Carbon::today()->toDateString(),
            'type' => 'repair',
            'cost' => 100,
        ])->assertCreated()->json('data.id');

        $this->auth()->putJson(self::BASE.'/'.$vehicle->id.'/maintenance/'.$id, ['cost' => 5])
            ->assertStatus(403)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'immutable'));

        $this->auth()->deleteJson(self::BASE.'/'.$vehicle->id.'/maintenance/'.$id)->assertStatus(403);

        $this->assertSame('100.00', $vehicle->maintenanceRecords()->first()->cost);
    }

    /** BR-8 — a system role may amend, and the amendment is stamped. */
    public function test_privileged_user_can_amend_and_amendment_is_stamped(): void
    {
        $vehicle = $this->makeVehicle();
        $id = $this->auth()->postJson(self::BASE.'/'.$vehicle->id.'/maintenance', [
            'performed_on' => Carbon::today()->toDateString(),
            'type' => 'repair',
            'cost' => 100,
        ])->assertCreated()->json('data.id');

        $this->grantMaintenancePermission();

        // An integral decimal JSON-encodes as int, so compare numerically.
        $this->auth()->putJson(self::BASE.'/'.$vehicle->id.'/maintenance/'.$id, ['cost' => 250])
            ->assertOk()
            ->assertJsonPath('data.cost', fn ($cost) => (float) $cost === 250.0)
            ->assertJsonPath('data.was_amended', true);

        $this->assertNotNull($vehicle->maintenanceRecords()->first()->amended_at);
    }

    public function test_privileged_user_can_delete_maintenance(): void
    {
        $vehicle = $this->makeVehicle();
        $id = $this->auth()->postJson(self::BASE.'/'.$vehicle->id.'/maintenance', [
            'performed_on' => Carbon::today()->toDateString(),
            'type' => 'routine',
        ])->assertCreated()->json('data.id');

        $this->grantMaintenancePermission();

        $this->auth()->deleteJson(self::BASE.'/'.$vehicle->id.'/maintenance/'.$id)->assertNoContent();
        $this->assertSame(0, $vehicle->maintenanceRecords()->count());
    }

    public function test_maintenance_permission_endpoint_reflects_capability(): void
    {
        $this->auth()->getJson(self::BASE.'/maintenance-permissions')
            ->assertOk()->assertJson(['can_manage_maintenance' => false]);

        $this->grantMaintenancePermission();

        $this->auth()->getJson(self::BASE.'/maintenance-permissions')
            ->assertOk()->assertJson(['can_manage_maintenance' => true]);
    }

    /** Attaches a system role, which the service treats as a maintenance manager. */
    private function grantMaintenancePermission(): void
    {
        $role = \Modules\IAM\Domain\Models\Role::create([
            'name' => 'Fleet Maintenance',
            'slug' => 'fleet-maintenance-'.uniqid(),
            'is_system' => true,
        ]);

        $this->user->roles()->attach($role->id);
        $this->user->unsetRelation('roles');

        $this->assertTrue(app(VehicleMaintenanceService::class)->canManage($this->user->fresh()));
    }

    // ── Filters ───────────────────────────────────────────────────────────────

    public function test_index_hides_archived_by_default(): void
    {
        $this->makeVehicle(['vehicle_code' => 'V1', 'plate_number' => 'P1']);
        $this->makeVehicle(['vehicle_code' => 'V2', 'plate_number' => 'P2', 'status' => 'archived']);

        $this->auth()->getJson(self::BASE)->assertOk()->assertJsonPath('meta.total', 1);
        $this->auth()->getJson(self::BASE.'?status=archived')->assertOk()->assertJsonPath('meta.total', 1);
        $this->auth()->getJson(self::BASE.'?status=all')->assertOk()->assertJsonPath('meta.total', 2);
    }

    public function test_index_search_and_type_filters(): void
    {
        $this->makeVehicle(['vehicle_code' => 'V1', 'plate_number' => 'AAA-1', 'type' => 'van', 'manufacturer' => 'Toyota']);
        $this->makeVehicle(['vehicle_code' => 'V2', 'plate_number' => 'BBB-2', 'type' => 'large_truck', 'manufacturer' => 'Volvo']);

        $this->auth()->getJson(self::BASE.'?search=Volvo')->assertOk()->assertJsonPath('meta.total', 1);
        $this->auth()->getJson(self::BASE.'?search=AAA-1')->assertOk()->assertJsonPath('meta.total', 1);
        $this->auth()->getJson(self::BASE.'?type=large_truck')->assertOk()->assertJsonPath('meta.total', 1);
    }

    public function test_index_expiry_filter(): void
    {
        Storage::fake('local');
        $expired = $this->makeVehicle(['vehicle_code' => 'V1', 'plate_number' => 'P1']);
        $this->makeVehicle(['vehicle_code' => 'V2', 'plate_number' => 'P2']);
        $this->uploadDocument($expired, VehicleDocumentType::License, Carbon::today()->subDay());

        $this->auth()->getJson(self::BASE.'?expiry=expired')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.plate_number', 'P1');
    }

    // ── Events ────────────────────────────────────────────────────────────────

    public function test_domain_events_are_dispatched(): void
    {
        Event::fake([VehicleCreated::class, VehicleStatusChanged::class, VehicleMaintenanceRecorded::class]);

        $id = $this->auth()->postJson(self::BASE, $this->payload())->assertCreated()->json('data.id');
        Event::assertDispatched(VehicleCreated::class);

        $this->auth()->patchJson(self::BASE.'/'.$id.'/status', ['status' => 'maintenance'])->assertOk();
        Event::assertDispatched(
            VehicleStatusChanged::class,
            fn (VehicleStatusChanged $e) => $e->from === VehicleStatus::Available
                && $e->to === VehicleStatus::Maintenance,
        );

        $this->auth()->postJson(self::BASE.'/'.$id.'/maintenance', [
            'performed_on' => Carbon::today()->toDateString(),
            'type' => 'routine',
        ])->assertCreated();
        Event::assertDispatched(VehicleMaintenanceRecorded::class);
    }

    public function test_no_event_when_status_is_unchanged(): void
    {
        Event::fake([VehicleStatusChanged::class]);
        $vehicle = $this->makeVehicle(['status' => 'available']);

        $this->auth()->patchJson(self::BASE.'/'.$vehicle->id.'/status', ['status' => 'available'])->assertOk();

        Event::assertNotDispatched(VehicleStatusChanged::class);
    }

    // ── Enum unit coverage ────────────────────────────────────────────────────

    public function test_status_transition_map_is_coherent(): void
    {
        $this->assertTrue(VehicleStatus::Available->canTransitionTo(VehicleStatus::Maintenance));
        $this->assertFalse(VehicleStatus::OutOfService->canTransitionTo(VehicleStatus::Available));
        $this->assertTrue(VehicleStatus::Archived->canTransitionTo(VehicleStatus::OutOfService));
        $this->assertFalse(VehicleStatus::Archived->canTransitionTo(VehicleStatus::Available));
        $this->assertTrue(VehicleStatus::Available->acceptsAssignment());
        $this->assertFalse(VehicleStatus::Maintenance->acceptsAssignment());
        $this->assertTrue(VehicleStatus::Assigned->isEngaged());
        $this->assertTrue(VehicleStatus::InDelivery->isEngaged());
    }

    public function test_document_type_dispatch_gating(): void
    {
        $this->assertTrue(VehicleDocumentType::License->blocksDispatchWhenExpired());
        $this->assertTrue(VehicleDocumentType::Insurance->blocksDispatchWhenExpired());
        $this->assertFalse(VehicleDocumentType::Inspection->blocksDispatchWhenExpired());
        $this->assertFalse(VehicleDocumentType::Other->blocksDispatchWhenExpired());
    }

    // ── Security ──────────────────────────────────────────────────────────────

    public function test_routes_require_authentication(): void
    {
        $vehicle = $this->makeVehicle();

        $this->getJson(self::BASE)->assertUnauthorized();
        $this->getJson(self::BASE.'/stats')->assertUnauthorized();
        $this->getJson(self::BASE.'/options')->assertUnauthorized();
        $this->getJson(self::BASE.'/'.$vehicle->id)->assertUnauthorized();
        $this->postJson(self::BASE, $this->payload(['vehicle_code' => 'VEH-X', 'plate_number' => 'X-1']))->assertUnauthorized();
        $this->patchJson(self::BASE.'/'.$vehicle->id.'/status', ['status' => 'maintenance'])->assertUnauthorized();
        $this->getJson(self::BASE.'/'.$vehicle->id.'/maintenance')->assertUnauthorized();
        $this->postJson(self::BASE.'/'.$vehicle->id.'/maintenance', [])->assertUnauthorized();
    }

    public function test_no_destroy_endpoint_for_vehicles(): void
    {
        $vehicle = $this->makeVehicle();

        $this->auth()->deleteJson(self::BASE.'/'.$vehicle->id)->assertStatus(405);
        $this->assertDatabaseHas('logistics_vehicles', ['id' => $vehicle->id]);
    }
}
