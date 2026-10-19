<?php

declare(strict_types=1);

namespace Tests\Feature\Logistics;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Modules\Logistics\Distribution\Domain\Enums\DeliveryStopStatus;
use Modules\Logistics\Distribution\Domain\Enums\PaymentType;
use Modules\Logistics\Distribution\Domain\Enums\SettlementStatus;
use Modules\Logistics\Distribution\Domain\Enums\TripReturnKind;
use Modules\Logistics\Distribution\Domain\Enums\TripStatus;
use Modules\Logistics\Distribution\Domain\Enums\TripType;
use Modules\Logistics\Distribution\Domain\Events\TripDispatched;
use Modules\Logistics\Distribution\Domain\Events\TripStatusChanged;
use Modules\Logistics\Distribution\Domain\Models\DeliveryStop;
use Modules\Logistics\Distribution\Domain\Models\Trip;
use Modules\Logistics\Distribution\Domain\Services\DeliveryService;
use Modules\Logistics\Distribution\Domain\Services\SettlementService;
use Modules\Logistics\Distribution\Domain\Services\TripService;
use Modules\Logistics\Drivers\Domain\Models\Driver;
use Modules\Logistics\Drivers\Domain\Services\DriverVehicleAssignmentService;
use Modules\Logistics\ShippingCompanies\Domain\Models\ShippingCompany;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * TASK-LOG-004B — Distribution Module
 *
 * Verifies the three bounded contexts (Trips, Delivery, Settlement) and, above
 * all, that Distribution CONSUMES the approved aggregates rather than
 * duplicating them: no driver_id, no vehicle_id, no carrier table, no pairing
 * logic of its own.
 */
class DistributionModuleTest extends TestCase
{
    use DatabaseTransactions;

    private const BASE = '/api/logistics/distribution';

    private User $user;

    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
        $this->company = Company::factory()->create();
    }

    private function auth(): static
    {
        return $this->actingAs($this->user);
    }

    // ── Fixtures ──────────────────────────────────────────────────────────────

    private function makeOrder(): string
    {
        $customerId = (string) Str::uuid();
        DB::table('customers')->insert([
            'id' => $customerId,
            'code' => 'CUS-'.substr(md5($customerId), 0, 8),
            'name' => 'Distribution Test Customer',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $orderId = (string) Str::uuid();
        DB::table('orders')->insert([
            'id' => $orderId,
            'customer_id' => $customerId,
            'order_number' => 'ORD-'.substr(md5($orderId), 0, 8),
            'order_date' => now()->toDateString(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $orderId;
    }

    private function makeTrip(array $overrides = []): Trip
    {
        return Trip::create(array_merge([
            'company_id' => $this->company->id,
            'trip_number' => 'TRP-'.substr(md5(uniqid('', true)), 0, 6),
            'name' => 'Cairo Morning Run',
            'type' => TripType::CompanyVehicle->value,
            'capacity' => 3,
            'created_by' => $this->user->id,
        ], $overrides));
    }

    private function makeDriver(array $overrides = []): Driver
    {
        $suffix = substr(md5(uniqid('', true)), 0, 8);

        return Driver::create(array_merge([
            'driver_code' => 'DRV-'.$suffix,
            'full_name' => 'Distribution Driver',
            'mobile' => '010'.substr($suffix, 0, 8),
            'national_id' => 'NID-'.$suffix,
            'license_issue_date' => '2024-01-01',
            'license_expiry_date' => '2031-01-01',
        ], $overrides));
    }

    private function makeVehicle(array $overrides = []): Vehicle
    {
        $suffix = substr(md5(uniqid('', true)), 0, 8);

        return Vehicle::create(array_merge([
            'vehicle_code' => 'VEH-'.$suffix,
            'plate_number' => 'PL-'.$suffix,
            'type' => 'van',
            'capacity_orders' => 60,
        ], $overrides));
    }

    /** Trip with a live driver/vehicle pairing, ready to be driven to dispatch. */
    private function makeResourcedTrip(): Trip
    {
        $trip = $this->makeTrip();
        $assignment = app(DriverVehicleAssignmentService::class)
            ->assign($this->makeDriver(), $this->makeVehicle());

        $trip->update(['driver_vehicle_assignment_id' => $assignment->id]);

        return $trip->refresh();
    }

    /** Drive a trip to Dispatched so delivery execution is permitted. */
    private function dispatchTrip(Trip $trip): Trip
    {
        $trips = app(TripService::class);
        $trip->update([
            'driver_accepted_products' => true,
            'driver_accepted_custody' => true,
            'driver_accepted_equipment' => true,
        ]);

        foreach ([
            TripStatus::Loading,
            TripStatus::LoadingCompleted,
            TripStatus::DriverAccepted,
            TripStatus::ReadyForDispatch,
            TripStatus::Dispatched,
        ] as $state) {
            $trip = $trips->changeStatus($trip->refresh(), $state);
        }

        return $trip->refresh();
    }

    // ── Reference data ────────────────────────────────────────────────────────

    public function test_options_expose_the_vocabularies(): void
    {
        $response = $this->auth()->getJson(self::BASE.'/trips/options')->assertOk();

        $this->assertCount(13, $response->json('statuses'));
        $this->assertCount(3, $response->json('types'));
        $this->assertCount(7, $response->json('custody_item_types'));

        $this->auth()->getJson(self::BASE.'/delivery/options')
            ->assertOk()
            ->assertJsonCount(7, 'stop_statuses')
            ->assertJsonCount(2, 'return_kinds');

        $this->auth()->getJson(self::BASE.'/settlement/options')
            ->assertOk()
            ->assertJsonCount(4, 'payment_types')
            ->assertJsonCount(5, 'settlement_statuses');
    }

    public function test_next_trip_number_is_sequential(): void
    {
        $this->auth()->getJson(self::BASE.'/trips/next-number?company_id='.$this->company->id)
            ->assertOk()->assertJson(['trip_number' => 'TRP-001']);

        $this->makeTrip(['trip_number' => 'TRP-001']);

        $this->auth()->getJson(self::BASE.'/trips/next-number?company_id='.$this->company->id)
            ->assertOk()->assertJson(['trip_number' => 'TRP-002']);
    }

    public function test_stats_group_trips_by_status(): void
    {
        $this->makeTrip(['status' => TripStatus::Planning->value]);
        $this->makeTrip(['status' => TripStatus::Dispatched->value]);
        $this->makeTrip(['status' => TripStatus::Closed->value]);

        $this->auth()->getJson(self::BASE.'/trips/stats?company_id='.$this->company->id)
            ->assertOk()
            ->assertJsonPath('total_trips', 3)
            ->assertJsonPath('planning', 1)
            ->assertJsonPath('on_the_road', 1)
            ->assertJsonPath('closed', 1);
    }

    // ── Trip CRUD ─────────────────────────────────────────────────────────────

    public function test_store_creates_trip_with_generated_number_and_uuid(): void
    {
        $response = $this->auth()->postJson(self::BASE.'/trips', [
            'company_id' => $this->company->id,
            'name' => 'Giza Afternoon Run',
            'capacity' => 40,
        ])->assertCreated();

        $this->assertSame('planning', $response->json('data.status'));
        $this->assertSame('TRP-001', $response->json('data.trip_number'));
        $this->assertNotNull($response->json('data.uuid'));
        $this->assertSame(40, $response->json('data.remaining_capacity'));
    }

    public function test_trip_requires_company_and_name(): void
    {
        $this->auth()->postJson(self::BASE.'/trips', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['company_id', 'name']);
    }

    public function test_update_edits_trip_but_never_status(): void
    {
        $trip = $this->makeTrip();

        $this->auth()->putJson(self::BASE.'/trips/'.$trip->uuid, [
            'name' => 'Renamed Run',
            'status' => TripStatus::Closed->value,
        ])->assertOk()->assertJsonPath('data.name', 'Renamed Run');

        $this->assertSame('planning', $trip->fresh()->status->value);
    }

    // ── Single source of truth (CTO directive 4) ──────────────────────────────

    public function test_trip_table_has_no_duplicate_master_data_columns(): void
    {
        $columns = DB::getSchemaBuilder()->getColumnListing('distribution_trips');

        foreach (['driver_id', 'vehicle_id', 'fleet_driver_id', 'fleet_vehicle_id',
            'external_carrier_id', 'driver_name', 'driver_phone'] as $forbidden) {
            $this->assertNotContains(
                $forbidden,
                $columns,
                "distribution_trips must not carry `{$forbidden}` — it would duplicate approved master data.",
            );
        }

        $this->assertContains('shipping_company_id', $columns);
        $this->assertContains('driver_vehicle_assignment_id', $columns);
    }

    public function test_trip_resolves_driver_and_vehicle_through_the_assignment(): void
    {
        $trip = $this->makeResourcedTrip();

        $response = $this->auth()->getJson(self::BASE.'/trips/'.$trip->uuid)->assertOk();

        $this->assertNotNull($response->json('data.driver_vehicle_assignment_id'));
        $this->assertSame('Distribution Driver', $response->json('data.driver.full_name'));
        $this->assertNotNull($response->json('data.vehicle.plate_number'));
    }

    public function test_assignment_endpoint_rejects_a_released_pairing(): void
    {
        $trip = $this->makeTrip();
        $driver = $this->makeDriver();
        $assignments = app(DriverVehicleAssignmentService::class);
        $assignment = $assignments->assign($driver, $this->makeVehicle());
        $assignments->release($driver);

        $this->auth()->patchJson(self::BASE.'/trips/'.$trip->uuid.'/assignment', [
            'driver_vehicle_assignment_id' => $assignment->id,
        ])->assertStatus(422);
    }

    public function test_trip_can_reference_a_shipping_company(): void
    {
        $carrier = ShippingCompany::create([
            'name' => 'Bosta', 'code' => 'SHC-D1', 'type' => 'external', 'status' => 'active',
        ]);
        $trip = $this->makeTrip([
            'type' => TripType::ExternalCarrier->value,
            'shipping_company_id' => $carrier->id,
        ]);

        $this->auth()->getJson(self::BASE.'/trips/'.$trip->uuid)
            ->assertOk()
            ->assertJsonPath('data.shipping_company_name', 'Bosta');
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    public function test_valid_lifecycle_transitions(): void
    {
        $trip = $this->makeTrip();

        $this->auth()->patchJson(self::BASE.'/trips/'.$trip->uuid.'/status', ['status' => 'loading'])
            ->assertOk()->assertJsonPath('data.status', 'loading');

        $this->auth()->patchJson(self::BASE.'/trips/'.$trip->uuid.'/status', ['status' => 'loading_completed'])
            ->assertOk()->assertJsonPath('data.status', 'loading_completed');
    }

    public function test_illegal_transition_is_rejected(): void
    {
        $trip = $this->makeTrip();

        $this->auth()->patchJson(self::BASE.'/trips/'.$trip->uuid.'/status', ['status' => 'completed'])
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'cannot move from Planning to Completed'));

        $this->assertSame('planning', $trip->fresh()->status->value);
    }

    public function test_terminal_states_cannot_be_left(): void
    {
        $trip = $this->makeTrip(['status' => TripStatus::Closed->value]);

        $this->auth()->patchJson(self::BASE.'/trips/'.$trip->uuid.'/status', ['status' => 'loading'])
            ->assertStatus(422);
    }

    public function test_resource_advertises_allowed_transitions(): void
    {
        $trip = $this->makeTrip(['status' => TripStatus::Planning->value]);

        $next = $this->auth()->getJson(self::BASE.'/trips/'.$trip->uuid)
            ->assertOk()->json('data.allowed_transitions');

        $this->assertSame(['loading', 'cancelled'], array_column($next, 'value'));
    }

    // ── Dispatch readiness — delegated to the owning aggregates ───────────────

    public function test_dispatch_blocked_without_orders_or_acceptance(): void
    {
        $trip = $this->makeResourcedTrip();

        $readiness = $this->auth()->getJson(self::BASE.'/trips/'.$trip->uuid.'/dispatch-readiness')
            ->assertOk()->json();

        $this->assertFalse($readiness['is_ready']);
        $this->assertContains('The trip has no orders assigned.', $readiness['blockers']);
    }

    public function test_dispatch_is_blocked_by_expired_driver_licence(): void
    {
        $trip = $this->makeTrip();
        $driver = $this->makeDriver(['license_expiry_date' => now()->subDay()->toDateString()]);
        $assignment = app(DriverVehicleAssignmentService::class)->assign($driver, $this->makeVehicle());

        $trip->update([
            'driver_vehicle_assignment_id' => $assignment->id,
            'driver_accepted_products' => true,
            'driver_accepted_custody' => true,
            'driver_accepted_equipment' => true,
        ]);
        app(TripService::class)->assignOrder($trip->refresh(), $this->makeOrder());

        $blockers = $this->auth()->getJson(self::BASE.'/trips/'.$trip->uuid.'/dispatch-readiness')
            ->assertOk()->json('blockers');

        $this->assertContains('The assigned driver cannot start deliveries (licence or status).', $blockers);
    }

    public function test_dispatch_transition_is_refused_while_blocked(): void
    {
        $trip = $this->makeResourcedTrip();
        $trips = app(TripService::class);

        foreach ([TripStatus::Loading, TripStatus::LoadingCompleted, TripStatus::DriverAccepted, TripStatus::ReadyForDispatch] as $s) {
            $trip = $trips->changeStatus($trip->refresh(), $s);
        }

        $this->auth()->patchJson(self::BASE.'/trips/'.$trip->uuid.'/status', ['status' => 'dispatched'])
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'cannot be dispatched'));
    }

    public function test_external_carrier_trip_needs_no_driver_pairing(): void
    {
        $carrier = ShippingCompany::create([
            'name' => 'Aramex', 'code' => 'SHC-D2', 'type' => 'external', 'status' => 'active',
        ]);
        $trip = $this->makeTrip([
            'type' => TripType::ExternalCarrier->value,
            'shipping_company_id' => $carrier->id,
            'driver_accepted_products' => true,
            'driver_accepted_custody' => true,
            'driver_accepted_equipment' => true,
        ]);
        app(TripService::class)->assignOrder($trip, $this->makeOrder());

        $this->assertTrue($trip->refresh()->isReadyForDispatch());
    }

    // ── Order assignment ──────────────────────────────────────────────────────

    public function test_assign_and_remove_order(): void
    {
        $trip = $this->makeTrip();
        $orderId = $this->makeOrder();

        $this->auth()->postJson(self::BASE.'/trips/'.$trip->uuid.'/orders', [
            'order_id' => $orderId, 'zone_code' => 'CAI-1',
        ])->assertCreated()->assertJsonPath('data.zone_code_snapshot', 'CAI-1');

        $this->assertSame(1, $trip->fresh()->orders_count);

        $this->auth()->deleteJson(self::BASE.'/trips/'.$trip->uuid.'/orders/'.$orderId)->assertNoContent();
        $this->assertSame(0, $trip->fresh()->orders_count);
    }

    public function test_order_cannot_be_on_two_trips(): void
    {
        $first = $this->makeTrip();
        $second = $this->makeTrip();
        $orderId = $this->makeOrder();

        $this->auth()->postJson(self::BASE.'/trips/'.$first->uuid.'/orders', ['order_id' => $orderId])->assertCreated();

        $this->auth()->postJson(self::BASE.'/trips/'.$second->uuid.'/orders', ['order_id' => $orderId])
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'already assigned to trip'));
    }

    public function test_capacity_is_enforced(): void
    {
        $trip = $this->makeTrip(['capacity' => 2]);

        foreach (range(1, 2) as $ignored) {
            $this->auth()->postJson(self::BASE.'/trips/'.$trip->uuid.'/orders', ['order_id' => $this->makeOrder()])
                ->assertCreated();
        }

        $this->auth()->postJson(self::BASE.'/trips/'.$trip->uuid.'/orders', ['order_id' => $this->makeOrder()])
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'capacity of 2 orders'));
    }

    public function test_orders_cannot_be_changed_once_past_loading(): void
    {
        $trip = $this->makeTrip(['status' => TripStatus::Dispatched->value]);

        $this->auth()->postJson(self::BASE.'/trips/'.$trip->uuid.'/orders', ['order_id' => $this->makeOrder()])
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'Planning or Loading'));
    }

    public function test_move_order_between_trips_is_atomic(): void
    {
        $from = $this->makeTrip();
        $to = $this->makeTrip();
        $orderId = $this->makeOrder();

        $this->auth()->postJson(self::BASE.'/trips/'.$from->uuid.'/orders', ['order_id' => $orderId])->assertCreated();

        $this->auth()->postJson(self::BASE.'/trips/'.$from->uuid.'/orders/move', [
            'order_id' => $orderId, 'target_trip_id' => $to->uuid,
        ])->assertCreated();

        $this->assertSame(0, $from->fresh()->orders_count);
        $this->assertSame(1, $to->fresh()->orders_count);
        $this->assertSame(1, $to->tripOrders()->where('order_id', $orderId)->count());
    }

    // ── Custody ───────────────────────────────────────────────────────────────

    public function test_custody_lifecycle_and_shortfall(): void
    {
        $trip = $this->makeTrip();

        $id = $this->auth()->postJson(self::BASE.'/trips/'.$trip->uuid.'/custody', [
            'item_type' => 'ice_boxes', 'quantity' => 5,
        ])->assertCreated()->assertJsonPath('data.item_type_label', 'Ice Boxes')->json('data.id');

        $this->auth()->patchJson(self::BASE.'/trips/'.$trip->uuid.'/custody/'.$id.'/confirm', [
            'received_quantity' => 3,
        ])->assertOk()
            ->assertJsonPath('data.has_shortfall', true)
            ->assertJsonPath('data.shortfall_quantity', 2)
            ->assertJsonPath('data.is_driver_confirmed', true);
    }

    public function test_custody_cannot_be_added_after_loading(): void
    {
        $trip = $this->makeTrip(['status' => TripStatus::Dispatched->value]);

        $this->auth()->postJson(self::BASE.'/trips/'.$trip->uuid.'/custody', ['item_type' => 'pos_device'])
            ->assertStatus(422);
    }

    public function test_driver_acceptance_flags_discrepancy_on_partial_confirmation(): void
    {
        $trip = $this->makeTrip();

        $this->auth()->patchJson(self::BASE.'/trips/'.$trip->uuid.'/driver-acceptance', [
            'products' => true, 'custody' => false, 'equipment' => true,
            'discrepancy_notes' => 'Two ice boxes missing',
        ])->assertOk()
            ->assertJsonPath('data.has_discrepancy', true)
            ->assertJsonPath('data.has_full_driver_acceptance', false);
    }

    // ── Delivery execution ────────────────────────────────────────────────────

    public function test_stops_are_generated_from_trip_orders_idempotently(): void
    {
        $trip = $this->makeTrip();
        app(TripService::class)->assignOrder($trip, $this->makeOrder());
        app(TripService::class)->assignOrder($trip->refresh(), $this->makeOrder());

        $this->auth()->postJson(self::BASE.'/trips/'.$trip->uuid.'/stops/generate')
            ->assertCreated()->assertJsonPath('created', 2);

        // Re-running creates nothing new.
        $this->auth()->postJson(self::BASE.'/trips/'.$trip->uuid.'/stops/generate')
            ->assertCreated()->assertJsonPath('created', 0);

        $this->assertSame(2, $trip->stops()->count());
    }

    public function test_delivery_cannot_be_executed_before_dispatch(): void
    {
        $trip = $this->makeTrip();
        app(TripService::class)->assignOrder($trip, $this->makeOrder());
        app(DeliveryService::class)->generateStops($trip->refresh());
        $stop = $trip->stops()->first();

        $this->auth()->patchJson(self::BASE.'/trips/'.$trip->uuid.'/stops/'.$stop->id.'/start')
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'on the road'));
    }

    public function test_complete_stop_records_outcome(): void
    {
        [$trip, $stop] = $this->tripWithStop();

        $this->auth()->patchJson(self::BASE.'/trips/'.$trip->uuid.'/stops/'.$stop->id.'/complete', [
            'status' => 'delivered', 'collected_amount' => 250.5, 'payment_method' => 'cash',
        ])->assertOk()
            ->assertJsonPath('data.status', 'delivered')
            ->assertJsonPath('data.is_settled', true)
            ->assertJsonPath('data.accepts_payment', true);
    }

    public function test_stop_cannot_be_completed_twice(): void
    {
        [$trip, $stop] = $this->tripWithStop();

        $this->auth()->patchJson(self::BASE.'/trips/'.$trip->uuid.'/stops/'.$stop->id.'/complete', ['status' => 'delivered'])
            ->assertOk();

        $this->auth()->patchJson(self::BASE.'/trips/'.$trip->uuid.'/stops/'.$stop->id.'/complete', ['status' => 'failed'])
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'already reached an outcome'));
    }

    public function test_actions_and_proof_are_recorded(): void
    {
        [$trip, $stop] = $this->tripWithStop();

        $this->auth()->postJson(self::BASE.'/trips/'.$trip->uuid.'/stops/'.$stop->id.'/actions', [
            'action_type' => 'reschedule', 'reason' => 'Customer unavailable',
            'new_delivery_date' => now()->addDay()->toDateString(),
        ])->assertCreated()->assertJsonPath('data.action_type', 'reschedule');

        $this->auth()->postJson(self::BASE.'/trips/'.$trip->uuid.'/stops/'.$stop->id.'/proof', [
            'signature_path' => 'proofs/sig.png', 'photos' => ['proofs/a.jpg', 'proofs/b.jpg'],
        ])->assertCreated()
            ->assertJsonPath('data.has_signature', true)
            ->assertJsonPath('data.photo_count', 2);
    }

    public function test_exception_can_be_raised_and_resolved(): void
    {
        [$trip, $stop] = $this->tripWithStop();

        $id = $this->auth()->postJson(self::BASE.'/trips/'.$trip->uuid.'/exceptions', [
            'exception_type' => 'damaged_goods',
            'description' => 'Two boxes crushed in transit',
            'stop_id' => $stop->id,
        ])->assertCreated()->assertJsonPath('data.is_resolved', false)->json('data.id');

        $this->auth()->patchJson(self::BASE.'/trips/'.$trip->uuid.'/exceptions/'.$id.'/resolve', [
            'resolution_notes' => 'Replacement dispatched',
        ])->assertOk()->assertJsonPath('data.is_resolved', true);
    }

    // ── Returns — the unified TripReturn ──────────────────────────────────────

    public function test_product_and_custody_returns_share_one_entity(): void
    {
        [$trip] = $this->tripWithStop();

        $this->auth()->postJson(self::BASE.'/trips/'.$trip->uuid.'/returns', [
            'kind' => TripReturnKind::Custody->value,
            'custody_type' => 'ice_boxes',
            'dispatched_qty' => 5,
            'returned_qty' => 4,
        ])->assertCreated()->assertJsonPath('data.kind_label', 'Custody Return');

        $this->auth()->getJson(self::BASE.'/trips/'.$trip->uuid.'/returns')
            ->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_product_return_requires_an_order(): void
    {
        [$trip] = $this->tripWithStop();

        $this->auth()->postJson(self::BASE.'/trips/'.$trip->uuid.'/returns', [
            'kind' => TripReturnKind::Product->value, 'returned_qty' => 1,
        ])->assertStatus(422)->assertJsonValidationErrors(['order_id', 'product_id']);
    }

    public function test_warehouse_confirmation_derives_discrepancy_and_liability(): void
    {
        [$trip] = $this->tripWithStop();

        $id = $this->auth()->postJson(self::BASE.'/trips/'.$trip->uuid.'/returns', [
            'kind' => TripReturnKind::Custody->value,
            'custody_type' => 'thermal_bags',
            'dispatched_qty' => 10,
            'returned_qty' => 10,
        ])->assertCreated()->json('data.id');

        // Warehouse counts only 8 — a 2-unit shortfall makes the driver liable.
        $this->auth()->patchJson(self::BASE.'/trips/'.$trip->uuid.'/returns/'.$id.'/confirm', [
            'warehouse_confirmed_qty' => 8,
        ])->assertOk()
            ->assertJsonPath('data.discrepancy_qty', fn ($v) => (float) $v === 2.0)
            ->assertJsonPath('data.has_discrepancy', true)
            ->assertJsonPath('data.driver_liable', true)
            ->assertJsonPath('data.is_confirmed', true);
    }

    // ── Settlement ────────────────────────────────────────────────────────────

    public function test_payment_only_allowed_on_delivered_stop(): void
    {
        [$trip, $stop] = $this->tripWithStop();

        $this->auth()->postJson(self::BASE.'/trips/'.$trip->uuid.'/stops/'.$stop->id.'/payments', [
            'payment_type' => 'cash', 'amount' => 100,
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'delivered or partially delivered'));
    }

    public function test_payments_roll_up_into_trip_totals(): void
    {
        [$trip, $stop] = $this->completedStop();

        $this->auth()->postJson(self::BASE.'/trips/'.$trip->uuid.'/stops/'.$stop->id.'/payments', [
            'payment_type' => 'cash', 'amount' => 300,
        ])->assertCreated()->assertJsonPath('data.is_physical_cash', true);

        $this->auth()->postJson(self::BASE.'/trips/'.$trip->uuid.'/stops/'.$stop->id.'/payments', [
            'payment_type' => 'bank_transfer', 'amount' => 200,
        ])->assertCreated();

        $trip->refresh();
        $this->assertSame('300.00', $trip->total_cash_collected);
        $this->assertSame('200.00', $trip->total_bank_transfers);
        $this->assertSame('500.00', $trip->collection_amount);
    }

    public function test_settlement_requires_every_stop_settled(): void
    {
        [$trip] = $this->tripWithStop();

        $this->auth()->postJson(self::BASE.'/trips/'.$trip->uuid.'/settlement')
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'every stop has reached an outcome'));
    }

    public function test_full_settlement_flow_balances(): void
    {
        [$trip, $stop] = $this->completedStop();
        app(SettlementService::class)->recordPayment($stop, [
            'payment_type' => PaymentType::Cash->value, 'amount' => 450,
        ]);

        $this->auth()->postJson(self::BASE.'/trips/'.$trip->uuid.'/settlement')
            ->assertCreated()
            ->assertJsonPath('data.cash_expected', fn ($v) => (float) $v === 450.0)
            ->assertJsonPath('data.status', 'draft');

        $this->auth()->patchJson(self::BASE.'/trips/'.$trip->uuid.'/settlement/submit-cash', [
            'driver_cash_submitted' => 450,
        ])->assertOk()
            ->assertJsonPath('data.discrepancy', fn ($v) => (float) $v === 0.0)
            ->assertJsonPath('data.is_balanced', true)
            ->assertJsonPath('data.status', 'submitted');

        $this->auth()->patchJson(self::BASE.'/trips/'.$trip->uuid.'/settlement/reconcile')
            ->assertOk()->assertJsonPath('data.status', 'reconciled');

        $this->auth()->patchJson(self::BASE.'/trips/'.$trip->uuid.'/settlement/finalize')
            ->assertOk()
            ->assertJsonPath('data.status', 'finalized')
            ->assertJsonPath('data.is_final', true);
    }

    public function test_short_settlement_is_detected(): void
    {
        [$trip, $stop] = $this->completedStop();
        app(SettlementService::class)->recordPayment($stop, [
            'payment_type' => PaymentType::Cash->value, 'amount' => 500,
        ]);

        $this->auth()->postJson(self::BASE.'/trips/'.$trip->uuid.'/settlement')->assertCreated();

        $this->auth()->patchJson(self::BASE.'/trips/'.$trip->uuid.'/settlement/submit-cash', [
            'driver_cash_submitted' => 460,
        ])->assertOk()
            ->assertJsonPath('data.discrepancy', fn ($v) => (float) $v === -40.0)
            ->assertJsonPath('data.is_short', true)
            ->assertJsonPath('data.is_balanced', false);
    }

    public function test_rejected_payment_is_excluded_from_expected_cash(): void
    {
        [$trip, $stop] = $this->completedStop();
        $settlements = app(SettlementService::class);
        $good = $settlements->recordPayment($stop, ['payment_type' => 'cash', 'amount' => 100]);
        $bad = $settlements->recordPayment($stop, ['payment_type' => 'cash', 'amount' => 999]);

        $settlements->rejectPayment($bad, 'Counterfeit note');

        $this->auth()->postJson(self::BASE.'/trips/'.$trip->uuid.'/settlement')
            ->assertCreated()->assertJsonPath('data.cash_expected', fn ($v) => (float) $v === 100.0);

        $this->assertNotNull($good->id);
    }

    public function test_finalizing_settlement_closes_the_trip(): void
    {
        [$trip, $stop] = $this->completedStop();
        $settlements = app(SettlementService::class);
        $settlements->recordPayment($stop, ['payment_type' => 'cash', 'amount' => 10]);
        $settlement = $settlements->openSettlement($trip->refresh());
        $settlements->submitDriverCash($settlement, 10.0);
        $settlements->reconcile($settlement->refresh());

        $trips = app(TripService::class);
        $trips->changeStatus($trip->refresh(), TripStatus::InProgress);
        $trips->changeStatus($trip->refresh(), TripStatus::Completed);
        $settlements->finalize($settlement->refresh(), $this->user->id);

        $this->assertSame('closed', $trip->fresh()->status->value);
    }

    public function test_finalized_settlement_is_immutable(): void
    {
        [$trip, $stop] = $this->completedStop();
        $settlements = app(SettlementService::class);
        $settlements->recordPayment($stop, ['payment_type' => 'cash', 'amount' => 10]);
        $settlement = $settlements->openSettlement($trip->refresh());
        $settlements->submitDriverCash($settlement, 10.0);
        $settlements->reconcile($settlement->refresh());
        $settlements->finalize($settlement->refresh(), $this->user->id);

        $this->auth()->patchJson(self::BASE.'/trips/'.$trip->uuid.'/settlement/submit-cash', [
            'driver_cash_submitted' => 99,
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'finalized'));
    }

    public function test_financial_summary_reports_the_trip(): void
    {
        [$trip, $stop] = $this->completedStop();
        app(SettlementService::class)->recordPayment($stop, ['payment_type' => 'cash', 'amount' => 75]);

        $this->auth()->getJson(self::BASE.'/trips/'.$trip->uuid.'/financial-summary')
            ->assertOk()
            ->assertJsonPath('cash_collected', fn ($v) => (float) $v === 75.0)
            ->assertJsonPath('total_collected', fn ($v) => (float) $v === 75.0)
            ->assertJsonPath('stops_outstanding', 0);
    }

    // ── Events ────────────────────────────────────────────────────────────────

    public function test_domain_events_are_dispatched(): void
    {
        Event::fake([TripStatusChanged::class, TripDispatched::class]);

        $trip = $this->makeResourcedTrip();
        app(TripService::class)->assignOrder($trip, $this->makeOrder());
        $this->dispatchTrip($trip->refresh());

        Event::assertDispatched(TripStatusChanged::class);
        Event::assertDispatched(TripDispatched::class);
    }

    public function test_no_event_when_status_is_unchanged(): void
    {
        Event::fake([TripStatusChanged::class]);
        $trip = $this->makeTrip();

        app(TripService::class)->changeStatus($trip, TripStatus::Planning);

        Event::assertNotDispatched(TripStatusChanged::class);
    }

    // ── Enum unit coverage ────────────────────────────────────────────────────

    public function test_trip_status_transition_map_is_coherent(): void
    {
        $this->assertTrue(TripStatus::Planning->canTransitionTo(TripStatus::Loading));
        $this->assertFalse(TripStatus::Planning->canTransitionTo(TripStatus::Dispatched));
        $this->assertTrue(TripStatus::Closed->isTerminal());
        $this->assertSame([], TripStatus::Closed->allowedTransitions());
        $this->assertTrue(TripStatus::Planning->isEditable());
        $this->assertFalse(TripStatus::Dispatched->isEditable());
        $this->assertTrue(TripStatus::Dispatched->acceptsDeliveryExecution());
        $this->assertFalse(TripStatus::Planning->acceptsDeliveryExecution());
    }

    public function test_settlement_status_map_and_payment_semantics(): void
    {
        $this->assertTrue(SettlementStatus::Draft->canTransitionTo(SettlementStatus::Submitted));
        $this->assertFalse(SettlementStatus::Draft->canTransitionTo(SettlementStatus::Finalized));
        $this->assertTrue(SettlementStatus::Finalized->isFinal());
        $this->assertTrue(PaymentType::Cash->isPhysicalCash());
        $this->assertFalse(PaymentType::BankTransfer->isPhysicalCash());
        $this->assertTrue(DeliveryStopStatus::Delivered->acceptsPayment());
        $this->assertFalse(DeliveryStopStatus::Failed->acceptsPayment());
        $this->assertTrue(DeliveryStopStatus::Failed->isSettled());
    }

    public function test_external_carrier_type_needs_no_pairing(): void
    {
        $this->assertFalse(TripType::ExternalCarrier->requiresDriverVehicleAssignment());
        $this->assertTrue(TripType::CompanyVehicle->requiresDriverVehicleAssignment());
    }

    // ── Security ──────────────────────────────────────────────────────────────

    public function test_routes_require_authentication(): void
    {
        $trip = $this->makeTrip();

        $this->getJson(self::BASE.'/trips')->assertUnauthorized();
        $this->getJson(self::BASE.'/trips/stats')->assertUnauthorized();
        $this->getJson(self::BASE.'/trips/'.$trip->uuid)->assertUnauthorized();
        $this->postJson(self::BASE.'/trips', [])->assertUnauthorized();
        $this->patchJson(self::BASE.'/trips/'.$trip->uuid.'/status', ['status' => 'loading'])->assertUnauthorized();
        $this->getJson(self::BASE.'/trips/'.$trip->uuid.'/stops')->assertUnauthorized();
        $this->getJson(self::BASE.'/trips/'.$trip->uuid.'/settlement')->assertUnauthorized();
    }

    // ── Fixtures for delivery flows ───────────────────────────────────────────

    /** @return array{0: Trip, 1: DeliveryStop} */
    private function tripWithStop(): array
    {
        $trip = $this->makeResourcedTrip();
        app(TripService::class)->assignOrder($trip, $this->makeOrder());
        app(DeliveryService::class)->generateStops($trip->refresh());
        $trip = $this->dispatchTrip($trip->refresh());

        return [$trip, $trip->stops()->first()];
    }

    /** @return array{0: Trip, 1: DeliveryStop} */
    private function completedStop(): array
    {
        [$trip, $stop] = $this->tripWithStop();

        $completed = app(DeliveryService::class)->completeStop($stop, DeliveryStopStatus::Delivered);

        return [$trip->refresh(), $completed];
    }
}
