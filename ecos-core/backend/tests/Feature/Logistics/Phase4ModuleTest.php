<?php

declare(strict_types=1);

namespace Tests\Feature\Logistics;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Modules\IAM\Domain\Models\Permission;
use Modules\IAM\Domain\Models\Role;
use Modules\Logistics\Dispatch\Domain\Enums\ConflictType;
use Modules\Logistics\Dispatch\Domain\Models\DispatchConflict;
use Modules\Logistics\Drivers\Domain\Models\Driver;
use Modules\Logistics\Network\Domain\Enums\CapacityUnit;
use Modules\Logistics\Network\Domain\Models\CapacityPlan;
use Modules\Logistics\Network\Domain\Models\CapacitySlot;
use Modules\Logistics\Network\Domain\Models\ServiceArea;
use Modules\Logistics\Network\Domain\Services\CapacityLedgerService;
use Modules\Logistics\Operations\Domain\Enums\ExceptionCategory;
use Modules\Logistics\Operations\Domain\Enums\ExceptionSeverity;
use Modules\Logistics\Operations\Domain\Enums\ExceptionSource;
use Modules\Logistics\Operations\Domain\Enums\ExceptionStatus;
use Modules\Logistics\Operations\Domain\Enums\PoolMemberStatus;
use Modules\Logistics\Operations\Domain\Enums\PoolMemberType;
use Modules\Logistics\Operations\Domain\Enums\PoolStatus;
use Modules\Logistics\Operations\Domain\Enums\PoolType;
use Modules\Logistics\Operations\Domain\Enums\ReservationStatus;
use Modules\Logistics\Operations\Domain\Models\AlertRule;
use Modules\Logistics\Operations\Domain\Models\CapacityReservation;
use Modules\Logistics\Operations\Domain\Models\ExceptionNote;
use Modules\Logistics\Operations\Domain\Models\OperationalException;
use Modules\Logistics\Operations\Domain\Models\ReservationAuditEntry;
use Modules\Logistics\Operations\Domain\Models\ResourcePool;
use Modules\Logistics\Operations\Domain\Models\ResourcePoolMember;
use Modules\Logistics\Operations\Domain\Services\ExceptionEscalationService;
use Modules\Logistics\Operations\Domain\Services\ExceptionRegistryService;
use Modules\Logistics\Operations\Domain\Services\OperationalAlertService;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * EPIC-LOG-V2-001 Phase 4 — Resource Pools, Capacity Operations, Operational
 * Health and Exception Management.
 *
 * The directives these tests exist to hold:
 *
 *   • Directive 5  — Fleet remains the readiness authority
 *   • Directive 6  — Network remains the capacity authority
 *   • Directive 7  — Dispatch remains the orchestration authority
 *   • Directive 12 — one writer per table
 *   • Directive 13 — no duplicated business logic
 *   • Directive 14 — no duplicated master data
 */
class Phase4ModuleTest extends TestCase
{
    use DatabaseTransactions;

    private const OPS = '/api/logistics/operations';

    private User $user;

    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->user = User::factory()->create(['company_id' => $this->company->id]);

        $role = Role::create([
            'name' => 'Phase 4 Test Admin',
            'slug' => 'phase4-admin-'.substr(md5(uniqid('', true)), 0, 8),
            'is_system' => true,
        ]);
        $this->user->roles()->attach($role->id);
    }

    private function auth(): static
    {
        return $this->actingAs($this->user);
    }

    // ── Fixtures ──────────────────────────────────────────────────────────────

    private function suffix(): string
    {
        return substr(md5(uniqid('', true)), 0, 8);
    }

    private function makePool(array $overrides = []): ResourcePool
    {
        $response = $this->auth()->postJson(self::OPS.'/pools', array_merge([
            'code' => 'POOL-'.$this->suffix(),
            'name' => 'Cairo Day Shift',
            'pool_type' => PoolType::Mixed->value,
            'min_assignable' => 0,
        ], $overrides))->assertCreated();

        return ResourcePool::where('uuid', $response->json('data.id'))->firstOrFail();
    }

    private function activePool(array $overrides = []): ResourcePool
    {
        $pool = $this->makePool($overrides);

        $this->auth()->patchJson(self::OPS."/pools/{$pool->uuid}/status", [
            'status' => PoolStatus::Active->value,
        ])->assertOk();

        return $pool->refresh();
    }

    private function makeVehicle(): Vehicle
    {
        $suffix = $this->suffix();

        return Vehicle::create([
            'vehicle_code' => 'VEH-'.$suffix,
            'plate_number' => 'PL-'.$suffix,
            'type' => 'van',
            'capacity_orders' => 60,
            'company_id' => $this->company->id,
        ]);
    }

    private function makeDriver(): Driver
    {
        $suffix = $this->suffix();

        return Driver::create([
            'driver_code' => 'DRV-'.$suffix,
            'full_name' => 'Phase 4 Driver',
            'mobile' => '010'.substr($suffix, 0, 8),
            'national_id' => 'NID-'.$suffix,
            'license_issue_date' => '2024-01-01',
            'license_expiry_date' => '2031-01-01',
        ]);
    }

    private function makeSlot(int $orders = 100): CapacitySlot
    {
        $area = ServiceArea::create([
            'company_id' => $this->company->id,
            'code' => 'AREA-'.$this->suffix(),
            'name' => 'Nasr City',
            'status' => 'active',
            'default_lead_time_hours' => 24,
        ]);

        $plan = CapacityPlan::create([
            'company_id' => $this->company->id,
            'service_area_id' => $area->id,
            'plan_date' => now()->toDateString(),
            'is_published' => true,
            'published_at' => now(),
        ]);

        return CapacitySlot::create([
            'capacity_plan_id' => $plan->id,
            'window_start' => '09:00:00',
            'window_end' => '17:00:00',
            'available_orders' => $orders,
            'available_stops' => $orders,
            'available_weight_kg' => 1000,
            'available_volume_m3' => 50,
        ])->refresh();
    }

    private function reserve(CapacitySlot $slot, int $orders = 10): CapacityReservation
    {
        $response = $this->auth()->postJson(self::OPS.'/capacity/reservations', [
            'capacity_slot_id' => $slot->uuid,
            'orders' => $orders,
        ])->assertCreated();

        return CapacityReservation::where('uuid', $response->json('data.id'))->firstOrFail();
    }

    private function recordException(array $overrides = []): OperationalException
    {
        /** @var ExceptionRegistryService $registry */
        $registry = app(ExceptionRegistryService::class);

        return $registry->record(
            source: $overrides['source'] ?? ExceptionSource::Operations,
            category: $overrides['category'] ?? ExceptionCategory::Resource,
            exceptionType: $overrides['type'] ?? 'pool_below_strength',
            severity: $overrides['severity'] ?? ExceptionSeverity::Warning,
            title: $overrides['title'] ?? 'Pool below strength',
            dedupKey: $overrides['dedup_key'] ?? 'test:'.$this->suffix(),
            description: $overrides['description'] ?? 'Only 2 of 5 required members are available.',
            companyId: $this->company->id,
        );
    }

    // ═══ A. RESOURCE POOLS ═══════════════════════════════════════════════════

    public function test_options_expose_every_phase_4_pool_vocabulary(): void
    {
        $this->auth()->getJson(self::OPS.'/pools/options')
            ->assertOk()
            ->assertJsonCount(3, 'pool_types')
            ->assertJsonCount(4, 'pool_statuses')
            ->assertJsonCount(2, 'member_types')
            ->assertJsonCount(3, 'member_statuses');
    }

    public function test_a_pool_is_created_as_a_draft(): void
    {
        $this->auth()->postJson(self::OPS.'/pools', [
            'code' => 'POOL-'.$this->suffix(),
            'name' => 'Cairo Day Shift',
            'pool_type' => PoolType::Mixed->value,
        ])->assertCreated()
            ->assertJsonPath('data.status', PoolStatus::Draft->value)
            ->assertJsonPath('data.is_usable', false);
    }

    public function test_an_illegal_pool_transition_is_refused(): void
    {
        $pool = $this->makePool();

        $this->auth()->patchJson(self::OPS."/pools/{$pool->uuid}/status", [
            'status' => PoolStatus::Suspended->value,
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'cannot become'));
    }

    /** Archived is terminal: a pool nobody trusts must not come back. */
    public function test_an_archived_pool_cannot_be_revived(): void
    {
        $pool = $this->activePool();

        $this->auth()->patchJson(self::OPS."/pools/{$pool->uuid}/status", [
            'status' => PoolStatus::Archived->value,
        ])->assertOk();

        $this->auth()->patchJson(self::OPS."/pools/{$pool->uuid}/status", [
            'status' => PoolStatus::Active->value,
        ])->assertStatus(422);
    }

    public function test_a_vehicle_joins_a_pool(): void
    {
        $pool = $this->activePool();
        $vehicle = $this->makeVehicle();

        $this->auth()->postJson(self::OPS."/pools/{$pool->uuid}/members", [
            'member_type' => PoolMemberType::Vehicle->value,
            'member_id' => $vehicle->id,
            'reason' => 'Assigned to the Cairo depot.',
        ])->assertCreated()
            ->assertJsonPath('data.status', PoolMemberStatus::Active->value)
            // The row states who decides readiness, and it is never this module.
            ->assertJsonPath('data.readiness_authority', 'fleet');
    }

    public function test_a_driver_membership_names_drivers_as_its_readiness_authority(): void
    {
        $pool = $this->activePool();
        $driver = $this->makeDriver();

        $this->auth()->postJson(self::OPS."/pools/{$pool->uuid}/members", [
            'member_type' => PoolMemberType::Driver->value,
            'member_id' => $driver->id,
        ])->assertCreated()
            ->assertJsonPath('data.readiness_authority', 'drivers');
    }

    /** A vehicle pool holding drivers would field trips it cannot crew. */
    public function test_a_vehicle_pool_refuses_a_driver(): void
    {
        $pool = $this->activePool(['pool_type' => PoolType::Vehicle->value]);
        $driver = $this->makeDriver();

        $this->auth()->postJson(self::OPS."/pools/{$pool->uuid}/members", [
            'member_type' => PoolMemberType::Driver->value,
            'member_id' => $driver->id,
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'does not hold'));
    }

    /**
     * Uniqueness is the database's job. A read-then-write check is how two
     * concurrent adds both pass.
     */
    public function test_a_resource_cannot_join_the_same_pool_twice(): void
    {
        $pool = $this->activePool();
        $vehicle = $this->makeVehicle();

        $this->auth()->postJson(self::OPS."/pools/{$pool->uuid}/members", [
            'member_type' => PoolMemberType::Vehicle->value,
            'member_id' => $vehicle->id,
        ])->assertCreated();

        $this->auth()->postJson(self::OPS."/pools/{$pool->uuid}/members", [
            'member_type' => PoolMemberType::Vehicle->value,
            'member_id' => $vehicle->id,
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'already in this pool'));
    }

    /** Withdrawal frees the key so the resource can be re-added later. */
    public function test_a_withdrawn_resource_can_rejoin(): void
    {
        $pool = $this->activePool();
        $vehicle = $this->makeVehicle();

        $created = $this->auth()->postJson(self::OPS."/pools/{$pool->uuid}/members", [
            'member_type' => PoolMemberType::Vehicle->value,
            'member_id' => $vehicle->id,
        ])->assertCreated();

        $memberId = $created->json('data.id');

        $this->auth()->patchJson(self::OPS."/pools/members/{$memberId}/status", [
            'status' => PoolMemberStatus::Withdrawn->value,
            'reason' => 'Transferred to the Giza depot.',
        ])->assertOk();

        $this->auth()->postJson(self::OPS."/pools/{$pool->uuid}/members", [
            'member_type' => PoolMemberType::Vehicle->value,
            'member_id' => $vehicle->id,
        ])->assertCreated();
    }

    public function test_withdrawing_without_a_reason_is_refused(): void
    {
        $pool = $this->activePool();
        $vehicle = $this->makeVehicle();

        $created = $this->auth()->postJson(self::OPS."/pools/{$pool->uuid}/members", [
            'member_type' => PoolMemberType::Vehicle->value,
            'member_id' => $vehicle->id,
        ])->assertCreated();

        $this->auth()->patchJson(self::OPS."/pools/members/{$created->json('data.id')}/status", [
            'status' => PoolMemberStatus::Withdrawn->value,
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'needs a reason'));
    }

    /**
     * DIRECTIVE 14 — no duplicated master data. A membership row carries an id
     * and a status, and nothing that belongs to Vehicles or Drivers.
     */
    public function test_a_membership_row_stores_no_resource_attribute(): void
    {
        $pool = $this->activePool();
        $vehicle = $this->makeVehicle();

        $this->auth()->postJson(self::OPS."/pools/{$pool->uuid}/members", [
            'member_type' => PoolMemberType::Vehicle->value,
            'member_id' => $vehicle->id,
        ])->assertCreated();

        $columns = array_keys(
            ResourcePoolMember::where('resource_pool_id', $pool->id)->firstOrFail()->getAttributes()
        );

        foreach (['plate_number', 'vehicle_code', 'capacity_orders', 'full_name', 'driver_code'] as $forbidden) {
            $this->assertNotContains(
                $forbidden,
                $columns,
                "ops_resource_pool_members must not carry {$forbidden} — that belongs to the owning module."
            );
        }
    }

    /**
     * DIRECTIVE 5 — Fleet is the readiness authority. The unified view reports
     * its verdict; it does not compute one.
     */
    public function test_the_unified_view_carries_the_owning_modules_verdicts(): void
    {
        $pool = $this->activePool();
        $vehicle = $this->makeVehicle();

        $this->auth()->postJson(self::OPS."/pools/{$pool->uuid}/members", [
            'member_type' => PoolMemberType::Vehicle->value,
            'member_id' => $vehicle->id,
        ])->assertCreated();

        $this->auth()->getJson(self::OPS."/pools/{$pool->uuid}/unified")
            ->assertOk()
            ->assertJsonPath('data.members.0.readiness_authority', 'fleet')
            ->assertJsonPath('data.members.0.member_id', $vehicle->id)
            ->assertJsonStructure(['data' => ['members' => [['fitness', 'v1_dispatchable', 'is_available']]]]);
    }

    /**
     * A suspended membership means "this pool is not drawing on it", NOT "the
     * vehicle is unsafe". Conflating them would read as a safety verdict.
     */
    public function test_suspending_a_membership_removes_availability_without_touching_fitness(): void
    {
        $pool = $this->activePool();
        $vehicle = $this->makeVehicle();

        $created = $this->auth()->postJson(self::OPS."/pools/{$pool->uuid}/members", [
            'member_type' => PoolMemberType::Vehicle->value,
            'member_id' => $vehicle->id,
        ])->assertCreated();

        $this->auth()->patchJson(self::OPS."/pools/members/{$created->json('data.id')}/status", [
            'status' => PoolMemberStatus::Suspended->value,
            'reason' => 'Lent to another depot for the week.',
        ])->assertOk();

        $response = $this->auth()->getJson(self::OPS."/pools/{$pool->uuid}/unified")->assertOk();

        $this->assertFalse($response->json('data.members.0.is_available'));
        // Fleet's verdict is unchanged — membership said nothing about it.
        $this->assertNotNull($response->json('data.members.0.fitness'));
    }

    public function test_pool_health_states_its_reasons(): void
    {
        $pool = $this->activePool(['min_assignable' => 5]);

        $response = $this->auth()->getJson(self::OPS."/pools/{$pool->uuid}/health")->assertOk();

        $this->assertFalse($response->json('data.is_healthy'));
        // Ordered, readable reasons — the LOG-005 retryBlockers() contract.
        $this->assertNotEmpty($response->json('data.issues'));
    }

    /** A depot with vans and no drivers fields nothing, and must say so. */
    public function test_a_pool_with_vehicles_but_no_drivers_is_flagged(): void
    {
        $pool = $this->activePool();
        $vehicle = $this->makeVehicle();

        $this->auth()->postJson(self::OPS."/pools/{$pool->uuid}/members", [
            'member_type' => PoolMemberType::Vehicle->value,
            'member_id' => $vehicle->id,
        ])->assertCreated();

        $issues = $this->auth()->getJson(self::OPS."/pools/{$pool->uuid}/health")
            ->assertOk()
            ->json('data.issues');

        $this->assertTrue(
            collect($issues)->contains(fn (string $i) => str_contains($i, 'no drivers')),
            'A pool that cannot crew its vehicles must say so.'
        );
    }

    public function test_fieldable_units_is_the_smaller_of_the_two_sides(): void
    {
        $pool = $this->activePool();

        $this->auth()->postJson(self::OPS."/pools/{$pool->uuid}/members", [
            'member_type' => PoolMemberType::Vehicle->value,
            'member_id' => $this->makeVehicle()->id,
        ])->assertCreated();

        $this->auth()->postJson(self::OPS."/pools/{$pool->uuid}/members", [
            'member_type' => PoolMemberType::Vehicle->value,
            'member_id' => $this->makeVehicle()->id,
        ])->assertCreated();

        $this->auth()->postJson(self::OPS."/pools/{$pool->uuid}/members", [
            'member_type' => PoolMemberType::Driver->value,
            'member_id' => $this->makeDriver()->id,
        ])->assertCreated();

        $health = $this->auth()->getJson(self::OPS."/pools/{$pool->uuid}/health")->assertOk();

        $this->assertSame(
            min(
                $health->json('data.counts.available_vehicles'),
                $health->json('data.counts.available_drivers'),
            ),
            $health->json('data.fieldable_units'),
        );
    }

    public function test_the_availability_matrix_is_bounded_to_a_fortnight(): void
    {
        $this->activePool();

        $this->auth()->getJson(self::OPS.'/pools/availability-matrix?days=30')
            ->assertStatus(422);

        $this->auth()->getJson(self::OPS.'/pools/availability-matrix?days=7')
            ->assertOk()
            ->assertJsonCount(7, 'data.dates');
    }

    public function test_unassigned_resources_are_reported_separately(): void
    {
        $this->makeVehicle();

        $this->auth()->getJson(self::OPS.'/pools/unassigned')
            ->assertOk()
            ->assertJsonStructure(['data' => ['vehicles', 'drivers', 'idle_assignable_vehicles']]);
    }

    // ═══ B. CAPACITY OPERATIONS ══════════════════════════════════════════════

    public function test_a_reservation_takes_a_hold_through_the_ledger(): void
    {
        $slot = $this->makeSlot(100);

        $this->auth()->postJson(self::OPS.'/capacity/reservations', [
            'capacity_slot_id' => $slot->uuid,
            'orders' => 10,
            'purpose' => 'Morning wave.',
        ])->assertCreated()
            ->assertJsonPath('data.status', ReservationStatus::Held->value)
            ->assertJsonPath('data.holds_capacity', true)
            ->assertJsonPath('data.requested.orders', 10);

        // DIRECTIVE 6 — the ledger, not this module, moved the committed figure.
        $this->assertSame(10, (int) $slot->refresh()->committed_orders);
    }

    /**
     * DIRECTIVE 12 — one writer per table. Nothing in Operations may write
     * network_capacity_slots.
     */
    public function test_operations_never_writes_the_capacity_slot_itself(): void
    {
        $slot = $this->makeSlot(100);
        $before = (int) $slot->committed_orders;

        $reservation = $this->reserve($slot, 25);

        // The move is exactly the reserved amount — no second adjustment from
        // this module on top of the ledger's.
        $this->assertSame($before + 25, (int) $slot->refresh()->committed_orders);

        $this->auth()->patchJson(self::OPS."/capacity/reservations/{$reservation->uuid}/release", [
            'reason' => 'Wave cancelled.',
        ])->assertOk();

        $this->assertSame($before, (int) $slot->refresh()->committed_orders);
    }

    public function test_a_reservation_with_no_quantities_is_refused(): void
    {
        $slot = $this->makeSlot();

        $this->auth()->postJson(self::OPS.'/capacity/reservations', [
            'capacity_slot_id' => $slot->uuid,
            'orders' => 0,
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'at least one unit'));
    }

    /**
     * When the ledger refuses, its words survive — a paraphrase loses the
     * reason a zone was full.
     */
    public function test_a_refusal_keeps_networks_own_words_and_leaves_evidence(): void
    {
        $slot = $this->makeSlot(5);

        $this->auth()->postJson(self::OPS.'/capacity/reservations', [
            'capacity_slot_id' => $slot->uuid,
            'orders' => 500,
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'Network refused'));

        $failed = CapacityReservation::where('capacity_slot_id', $slot->id)
            ->where('status', ReservationStatus::Failed->value)
            ->first();

        $this->assertNotNull($failed, 'A refused ask must leave a record, not just an error.');
        $this->assertNotNull($failed->failure_reason);
    }

    public function test_confirming_a_hold_makes_it_firm(): void
    {
        $reservation = $this->reserve($this->makeSlot(), 10);

        $this->auth()->patchJson(self::OPS."/capacity/reservations/{$reservation->uuid}/confirm")
            ->assertOk()
            ->assertJsonPath('data.status', ReservationStatus::Confirmed->value)
            ->assertJsonPath('data.ledger_status', 'committed');
    }

    /** Releasing confirmed capacity is a decision somebody must own. */
    public function test_releasing_confirmed_capacity_requires_a_reason(): void
    {
        $reservation = $this->reserve($this->makeSlot(), 10);

        $this->auth()->patchJson(self::OPS."/capacity/reservations/{$reservation->uuid}/confirm")->assertOk();

        $this->auth()->patchJson(self::OPS."/capacity/reservations/{$reservation->uuid}/release", [])
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'needs a reason'));
    }

    /** An unconfirmed hold is routine to give back. */
    public function test_releasing_an_unconfirmed_hold_needs_no_reason(): void
    {
        $reservation = $this->reserve($this->makeSlot(), 10);

        $this->auth()->patchJson(self::OPS."/capacity/reservations/{$reservation->uuid}/release", [])
            ->assertOk()
            ->assertJsonPath('data.status', ReservationStatus::Released->value);
    }

    public function test_an_illegal_reservation_transition_is_refused(): void
    {
        $reservation = $this->reserve($this->makeSlot(), 10);

        $this->auth()->patchJson(self::OPS."/capacity/reservations/{$reservation->uuid}/release", [])->assertOk();

        $this->auth()->patchJson(self::OPS."/capacity/reservations/{$reservation->uuid}/confirm")
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'cannot become'));
    }

    public function test_every_reservation_movement_is_audited(): void
    {
        $reservation = $this->reserve($this->makeSlot(), 10);

        $this->auth()->patchJson(self::OPS."/capacity/reservations/{$reservation->uuid}/confirm")->assertOk();

        $actions = $this->auth()->getJson(self::OPS."/capacity/reservations/{$reservation->uuid}/audit")
            ->assertOk()
            ->json('data.*.action');

        $this->assertSame(
            [ReservationAuditEntry::ACTION_REQUESTED, ReservationAuditEntry::ACTION_HELD, ReservationAuditEntry::ACTION_CONFIRMED],
            $actions,
            'A reservation only reads in the order it happened.'
        );
    }

    /** Capacity disputes are settled from the audit trail, so it cannot move. */
    public function test_the_reservation_audit_trail_is_append_only(): void
    {
        $reservation = $this->reserve($this->makeSlot(), 10);

        $entry = ReservationAuditEntry::where('capacity_reservation_id', $reservation->id)->firstOrFail();

        $this->assertFalse($entry->update(['reason' => 'rewritten']));
        $this->assertFalse($entry->delete());
        $this->assertNull($entry->refresh()->reason);
    }

    public function test_rebalance_candidates_exclude_the_current_slot(): void
    {
        $slot = $this->makeSlot(100);
        $reservation = $this->reserve($slot, 10);

        $candidates = $this->auth()
            ->getJson(self::OPS."/capacity/reservations/{$reservation->uuid}/rebalance-candidates")
            ->assertOk()
            ->json('data.*.slot_id');

        $this->assertNotContains($slot->uuid, $candidates);
    }

    /**
     * Destination first, origin second. A rebalance that can lose the capacity
     * it was moving is worse than no rebalance.
     */
    public function test_a_failed_rebalance_leaves_the_original_hold_intact(): void
    {
        $origin = $this->makeSlot(100);
        $reservation = $this->reserve($origin, 40);

        $tiny = $this->makeSlot(5);

        $this->auth()->patchJson(self::OPS."/capacity/reservations/{$reservation->uuid}/rebalance", [
            'destination_slot_id' => $tiny->uuid,
        ])->assertStatus(422);

        $this->assertSame(40, (int) $origin->refresh()->committed_orders);
        $this->assertSame(ReservationStatus::Held, $reservation->refresh()->status);
    }

    public function test_rebalancing_moves_the_hold_and_reopens_it(): void
    {
        $origin = $this->makeSlot(100);
        $reservation = $this->reserve($origin, 10);

        $this->auth()->patchJson(self::OPS."/capacity/reservations/{$reservation->uuid}/confirm")->assertOk();

        $destination = $this->makeSlot(100);

        $this->auth()->patchJson(self::OPS."/capacity/reservations/{$reservation->uuid}/rebalance", [
            'destination_slot_id' => $destination->uuid,
            'reason' => 'Origin window closed early.',
        ])->assertOk()
            // Nobody has confirmed the destination, whatever the origin's state.
            ->assertJsonPath('data.status', ReservationStatus::Held->value)
            ->assertJsonPath('data.was_rebalanced', true);

        $this->assertSame(0, (int) $origin->refresh()->committed_orders);
        $this->assertSame(10, (int) $destination->refresh()->committed_orders);
    }

    public function test_rebalancing_to_the_same_slot_is_refused(): void
    {
        $slot = $this->makeSlot(100);
        $reservation = $this->reserve($slot, 10);

        $this->auth()->patchJson(self::OPS."/capacity/reservations/{$reservation->uuid}/rebalance", [
            'destination_slot_id' => $slot->uuid,
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'already on that slot'));
    }

    /** A rate with no denominator is unknown, not zero. */
    public function test_capacity_rates_are_null_when_nothing_was_asked(): void
    {
        $response = $this->auth()->getJson(self::OPS.'/capacity/monitoring')->assertOk();

        $this->assertNull($response->json('data.reservations.refusal_rate'));
        $this->assertNull($response->json('data.reservations.confirmation_rate'));
    }

    public function test_refusal_reasons_are_aggregated(): void
    {
        $slot = $this->makeSlot(5);

        $this->auth()->postJson(self::OPS.'/capacity/reservations', [
            'capacity_slot_id' => $slot->uuid, 'orders' => 500,
        ])->assertStatus(422);

        $this->auth()->postJson(self::OPS.'/capacity/reservations', [
            'capacity_slot_id' => $slot->uuid, 'orders' => 600,
        ])->assertStatus(422);

        $reasons = $this->auth()->getJson(self::OPS.'/capacity/monitoring')
            ->assertOk()
            ->json('data.refusal_reasons');

        $this->assertNotEmpty($reasons, 'Refusals only mean something in aggregate.');
    }

    // ═══ C. OPERATIONAL HEALTH ═══════════════════════════════════════════════

    public function test_the_overview_is_quiet_when_nothing_is_wrong(): void
    {
        $this->auth()->getJson(self::OPS.'/health/overview')
            ->assertOk()
            ->assertJsonPath('data.is_quiet', true)
            ->assertJsonPath('data.headline.critical_alerts', 0);
    }

    public function test_the_overview_stops_being_quiet_once_something_needs_attention(): void
    {
        $this->recordException(['severity' => ExceptionSeverity::Critical]);

        $this->auth()->getJson(self::OPS.'/health/overview')
            ->assertOk()
            ->assertJsonPath('data.is_quiet', false);
    }

    /**
     * DIRECTIVE 7 — Dispatch remains the orchestration authority. The health
     * screen reports Phase 3's own numbers rather than recomputing them.
     */
    public function test_dispatch_health_is_phase_3s_own_figures(): void
    {
        $this->auth()->getJson(self::OPS.'/health/dispatch')
            ->assertOk()
            ->assertJsonStructure(['data' => ['kpis', 'queue', 'assignment', 'exceptions']]);
    }

    public function test_capacity_health_reads_the_network_ledger(): void
    {
        $slot = $this->makeSlot(100);
        $this->reserve($slot, 50);

        $this->auth()->getJson(self::OPS.'/health/capacity')
            ->assertOk()
            ->assertJsonPath('data.reservations.currently_holding', 1)
            ->assertJsonStructure(['data' => ['slots' => ['avg_utilisation', 'exhausted']]]);
    }

    public function test_utilisation_reports_the_limiting_side(): void
    {
        $this->auth()->getJson(self::OPS.'/health/utilisation')
            ->assertOk()
            ->assertJsonStructure([
                'data' => ['fieldable_units', 'capacity_utilisation', 'unhealthy_pools'],
            ]);
    }

    /** No predictive AI anywhere in Phase 4 — operational metrics only. */
    public function test_no_phase_4_service_forecasts_anything(): void
    {
        $files = glob(base_path('Modules/Logistics/Operations/Domain/Services/*.php')) ?: [];

        $this->assertNotEmpty($files);

        foreach ($files as $file) {
            // Strip comments first: an explanatory comment about NOT predicting
            // must not read as a prediction.
            $source = preg_replace('#/\*.*?\*/|//[^\n]*#s', '', (string) file_get_contents($file));

            foreach (['forecast', 'predict', 'projection', 'machineLearning'] as $banned) {
                $this->assertStringNotContainsStringIgnoringCase(
                    $banned,
                    (string) $source,
                    basename($file).' must contain operational metrics only.'
                );
            }
        }
    }

    // ═══ D. EXCEPTION MANAGEMENT ═════════════════════════════════════════════

    public function test_exception_options_expose_every_vocabulary(): void
    {
        $this->auth()->getJson(self::OPS.'/exceptions/options')
            ->assertOk()
            ->assertJsonCount(9, 'sources')
            ->assertJsonCount(8, 'categories')
            ->assertJsonCount(3, 'severities')
            ->assertJsonCount(6, 'statuses')
            ->assertJsonPath('max_escalation_level', ExceptionEscalationService::MAX_LEVEL);
    }

    /**
     * Four hundred identical rows carry no information. A repeat is a counter,
     * not another row.
     */
    public function test_a_repeat_increments_the_count_instead_of_inserting(): void
    {
        $key = 'carrier_outage:'.$this->suffix();

        $first = $this->recordException(['dedup_key' => $key]);
        $second = $this->recordException(['dedup_key' => $key]);

        $this->assertSame($first->id, $second->id);
        $this->assertSame(2, $second->occurrence_count);
        $this->assertSame(1, OperationalException::where('dedup_key', $key)->count());
    }

    /** A problem that was critical once does not become routine. */
    public function test_a_worse_recurrence_raises_severity_but_a_milder_one_does_not(): void
    {
        $key = 'severity:'.$this->suffix();

        $this->recordException(['dedup_key' => $key, 'severity' => ExceptionSeverity::Warning]);
        $raised = $this->recordException(['dedup_key' => $key, 'severity' => ExceptionSeverity::Critical]);

        $this->assertSame(ExceptionSeverity::Critical, $raised->severity);

        $unchanged = $this->recordException(['dedup_key' => $key, 'severity' => ExceptionSeverity::Info]);

        $this->assertSame(ExceptionSeverity::Critical, $unchanged->severity);
    }

    /**
     * DIRECTIVE 13 — the Phase 3 conflict framework is reused, not replaced.
     * Severity and authority are taken from Dispatch, never re-judged.
     */
    public function test_an_exception_from_a_conflict_inherits_dispatchs_judgement(): void
    {
        $conflict = DispatchConflict::create([
            'company_id' => $this->company->id,
            'conflict_type' => ConflictType::VehicleUnfit->value,
            'description' => 'Brake inspection lapsed 3 days ago.',
            'resource_type' => 'vehicle',
            'resource_id' => 42,
        ]);

        /** @var ExceptionRegistryService $registry */
        $registry = app(ExceptionRegistryService::class);
        $exception = $registry->fromConflict($conflict);

        // Dispatch said fleet owns it; Operations repeats that verbatim.
        $this->assertSame(ExceptionSource::Fleet, $exception->source);
        $this->assertSame(ExceptionCategory::Resource, $exception->category);
        $this->assertSame(ExceptionSeverity::Critical, $exception->severity);
        $this->assertSame('Brake inspection lapsed 3 days ago.', $exception->description);
        $this->assertSame($conflict->id, $exception->source_conflict_id);
    }

    /** The same clash must not appear twice in the merged queue. */
    public function test_the_same_conflict_cannot_be_registered_twice(): void
    {
        $conflict = DispatchConflict::create([
            'company_id' => $this->company->id,
            'conflict_type' => ConflictType::CapacityExceeded->value,
            'description' => 'The slot is full.',
        ]);

        $registry = app(ExceptionRegistryService::class);

        $first = $registry->fromConflict($conflict);
        $second = $registry->fromConflict($conflict);

        $this->assertSame($first->id, $second->id);
    }

    public function test_acknowledging_records_who_looked_at_it(): void
    {
        $exception = $this->recordException();

        $this->auth()->patchJson(self::OPS."/exceptions/{$exception->uuid}/acknowledge")
            ->assertOk()
            ->assertJsonPath('data.status', ExceptionStatus::Acknowledged->value)
            ->assertJsonPath('data.needs_attention', false);
    }

    /**
     * Operations cannot make another module's fact untrue. Closing a Fleet
     * exception here would not put the vehicle back on the road.
     */
    public function test_another_modules_exception_cannot_simply_be_closed(): void
    {
        $exception = $this->recordException(['source' => ExceptionSource::Fleet]);

        $this->auth()->patchJson(self::OPS."/exceptions/{$exception->uuid}/resolve", [
            'resolution' => OperationalException::RESOLUTION_FIXED,
            'reason' => 'Looks fine now.',
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'belongs to Fleet'));
    }

    /** It CAN be tidied away by stating plainly that Fleet dealt with it. */
    public function test_another_modules_exception_closes_as_handled_elsewhere(): void
    {
        $exception = $this->recordException(['source' => ExceptionSource::Fleet]);

        $this->auth()->patchJson(self::OPS."/exceptions/{$exception->uuid}/resolve", [
            'resolution' => OperationalException::RESOLUTION_HANDLED_ELSEWHERE,
            'reason' => 'Fleet cleared the inspection this morning.',
        ])->assertOk()
            ->assertJsonPath('data.status', ExceptionStatus::Resolved->value);
    }

    public function test_operations_own_exception_can_be_closed_outright(): void
    {
        $exception = $this->recordException(['source' => ExceptionSource::Operations]);

        $this->auth()->patchJson(self::OPS."/exceptions/{$exception->uuid}/resolve", [
            'resolution' => OperationalException::RESOLUTION_FIXED,
            'reason' => 'Two more vans were added to the pool.',
        ])->assertOk()
            ->assertJsonPath('data.status', ExceptionStatus::Resolved->value);
    }

    public function test_closing_without_a_reason_is_refused(): void
    {
        $exception = $this->recordException();

        $this->auth()->patchJson(self::OPS."/exceptions/{$exception->uuid}/resolve", [
            'resolution' => OperationalException::RESOLUTION_FIXED,
        ])->assertStatus(422);
    }

    /** Resolving frees the key so a recurrence raises a fresh exception. */
    public function test_a_recurrence_after_resolution_is_a_new_exception(): void
    {
        $key = 'recurring:'.$this->suffix();

        $first = $this->recordException(['dedup_key' => $key]);

        $this->auth()->patchJson(self::OPS."/exceptions/{$first->uuid}/resolve", [
            'resolution' => OperationalException::RESOLUTION_FIXED,
            'reason' => 'Dealt with.',
        ])->assertOk();

        $second = $this->recordException(['dedup_key' => $key]);

        $this->assertNotSame($first->id, $second->id);
        $this->assertSame(1, $second->occurrence_count);
    }

    /** Suppression must not become a way to lose problems permanently. */
    public function test_a_suppressed_exception_returns_when_it_happens_again(): void
    {
        $key = 'suppressed:'.$this->suffix();
        $exception = $this->recordException(['dedup_key' => $key]);

        $this->auth()->patchJson(self::OPS."/exceptions/{$exception->uuid}/suppress", [
            'reason' => 'Known issue, being worked on upstream.',
        ])->assertOk()
            ->assertJsonPath('data.status', ExceptionStatus::Suppressed->value);

        $again = $this->recordException(['dedup_key' => $key]);

        $this->assertSame(ExceptionStatus::Open, $again->status);
    }

    public function test_escalating_without_a_reason_is_refused(): void
    {
        $exception = $this->recordException();

        $this->auth()->postJson(self::OPS."/exceptions/{$exception->uuid}/escalate", [])
            ->assertStatus(422);
    }

    public function test_escalation_records_its_level_and_reason(): void
    {
        $exception = $this->recordException();

        $this->auth()->postJson(self::OPS."/exceptions/{$exception->uuid}/escalate", [
            'reason' => 'Nobody has picked this up in an hour.',
            'to_role' => 'operations_director',
        ])->assertCreated()
            ->assertJsonPath('data.level', 1)
            ->assertJsonPath('data.escalated_to_role', 'operations_director');

        $this->assertSame(ExceptionStatus::Escalated, $exception->refresh()->status);
    }

    /** An unbounded ladder teaches the top of the chain to ignore the channel. */
    public function test_escalation_is_capped(): void
    {
        $exception = $this->recordException();

        for ($i = 1; $i <= ExceptionEscalationService::MAX_LEVEL; $i++) {
            $this->auth()->postJson(self::OPS."/exceptions/{$exception->uuid}/escalate", [
                'reason' => "Escalation {$i}.",
            ])->assertCreated();
        }

        $this->auth()->postJson(self::OPS."/exceptions/{$exception->uuid}/escalate", [
            'reason' => 'One more for luck.',
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'already escalated'));
    }

    /** Escalating trivia is how an escalation channel becomes noise. */
    public function test_info_exceptions_never_escalate_on_a_timer(): void
    {
        $exception = $this->recordException(['severity' => ExceptionSeverity::Info]);
        $exception->update(['first_seen_at' => now()->subDay()]);

        $this->auth()->postJson(self::OPS.'/exceptions/maintenance/escalate-overdue')
            ->assertOk()
            ->assertJsonPath('escalated', 0);
    }

    public function test_an_overdue_critical_exception_escalates_on_the_sweep(): void
    {
        $exception = $this->recordException(['severity' => ExceptionSeverity::Critical]);
        $exception->update(['first_seen_at' => now()->subHours(2)]);

        $this->auth()->postJson(self::OPS.'/exceptions/maintenance/escalate-overdue')
            ->assertOk()
            ->assertJsonPath('escalated', 1);
    }

    public function test_notes_are_append_only_and_handovers_pin_themselves(): void
    {
        $exception = $this->recordException();

        $this->auth()->postJson(self::OPS."/exceptions/{$exception->uuid}/notes", [
            'body' => 'Called the depot; two vans are back tomorrow.',
            'note_type' => ExceptionNote::TYPE_HANDOVER,
        ])->assertCreated()
            ->assertJsonPath('data.is_pinned', true);

        $note = ExceptionNote::where('exception_id', $exception->id)->firstOrFail();

        $this->assertFalse($note->update(['body' => 'rewritten']));
        $this->assertFalse($note->delete());
    }

    public function test_an_empty_note_is_refused(): void
    {
        $exception = $this->recordException();

        $this->auth()->postJson(self::OPS."/exceptions/{$exception->uuid}/notes", ['body' => '   '])
            ->assertStatus(422);
    }

    public function test_the_queue_is_ordered_loudest_first(): void
    {
        $this->recordException(['severity' => ExceptionSeverity::Info, 'title' => 'Quiet']);
        $this->recordException(['severity' => ExceptionSeverity::Critical, 'title' => 'Loud']);
        $this->recordException(['severity' => ExceptionSeverity::Warning, 'title' => 'Middling']);

        $titles = $this->auth()->getJson(self::OPS.'/exceptions?outstanding_only=1')
            ->assertOk()
            ->json('data.*.title');

        $this->assertSame(['Loud', 'Middling', 'Quiet'], $titles);
    }

    public function test_the_summary_reports_null_when_the_queue_is_empty(): void
    {
        $this->auth()->getJson(self::OPS.'/exceptions/summary')
            ->assertOk()
            ->assertJsonPath('data.outstanding', 0)
            ->assertJsonPath('data.oldest_minutes', null);
    }

    /** Exceptions clear themselves when Dispatch settles the conflict. */
    public function test_exceptions_close_when_their_conflict_is_settled(): void
    {
        $conflict = DispatchConflict::create([
            'company_id' => $this->company->id,
            'conflict_type' => ConflictType::VehicleUnfit->value,
            'description' => 'Inspection lapsed.',
        ]);

        $exception = app(ExceptionRegistryService::class)->fromConflict($conflict);

        $conflict->update(['status' => 'resolved', 'resolved_at' => now()]);

        $this->auth()->postJson(self::OPS.'/exceptions/maintenance/reconcile')
            ->assertOk()
            ->assertJsonPath('closed', 1);

        // AutoResolved, not Resolved — nobody did any work, and the statistics
        // must not claim otherwise.
        $this->assertSame(ExceptionStatus::AutoResolved, $exception->refresh()->status);
    }

    // ── Alerts ────────────────────────────────────────────────────────────────

    /** A fresh install that silently alerts on nothing is a trap. */
    public function test_critical_exceptions_alert_even_with_no_rules_configured(): void
    {
        $this->recordException(['severity' => ExceptionSeverity::Critical]);

        $this->auth()->getJson(self::OPS.'/exceptions/alerts')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_a_suppressing_rule_silences_a_matching_exception(): void
    {
        $this->recordException([
            'severity' => ExceptionSeverity::Critical,
            'source' => ExceptionSource::Operations,
        ]);

        app(OperationalAlertService::class)->createRule([
            'company_id' => $this->company->id,
            'name' => 'Silence operations noise',
            'source' => ExceptionSource::Operations->value,
            'min_severity' => ExceptionSeverity::Info->value,
            'suppress' => true,
            'suppress_reason' => 'Known, being worked on.',
        ]);

        $this->auth()->getJson(self::OPS.'/exceptions/alerts')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_alerts_disappear_when_the_exception_closes(): void
    {
        $exception = $this->recordException([
            'severity' => ExceptionSeverity::Critical,
            'source' => ExceptionSource::Operations,
        ]);

        $this->auth()->getJson(self::OPS.'/exceptions/alerts')->assertJsonCount(1, 'data');

        $this->auth()->patchJson(self::OPS."/exceptions/{$exception->uuid}/resolve", [
            'resolution' => OperationalException::RESOLUTION_FIXED,
            'reason' => 'Dealt with.',
        ])->assertOk();

        // No second table to tidy: an alert IS an exception a rule matched.
        $this->auth()->getJson(self::OPS.'/exceptions/alerts')->assertJsonCount(0, 'data');
    }

    public function test_an_alert_rule_can_be_created_and_listed(): void
    {
        $this->auth()->postJson(self::OPS.'/exceptions/alerts/rules', [
            'name' => 'Critical capacity',
            'category' => ExceptionCategory::Capacity->value,
            'min_severity' => ExceptionSeverity::Critical->value,
            'escalate_after_minutes' => 10,
            'escalate_to_role' => 'operations_director',
        ])->assertCreated();

        $this->auth()->getJson(self::OPS.'/exceptions/alerts/rules')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Critical capacity');
    }

    // ═══ ACCESS CONTROL ══════════════════════════════════════════════════════

    public function test_every_phase_4_endpoint_requires_authentication(): void
    {
        $endpoints = [
            ['get', self::OPS.'/pools'],
            ['get', self::OPS.'/pools/health'],
            ['get', self::OPS.'/pools/availability-matrix'],
            ['post', self::OPS.'/pools'],
            ['get', self::OPS.'/capacity/reservations'],
            ['post', self::OPS.'/capacity/reservations'],
            ['get', self::OPS.'/capacity/monitoring'],
            ['get', self::OPS.'/health/overview'],
            ['get', self::OPS.'/health/resources'],
            ['get', self::OPS.'/health/capacity'],
            ['get', self::OPS.'/health/dispatch'],
            ['get', self::OPS.'/health/utilisation'],
            ['get', self::OPS.'/exceptions'],
            ['get', self::OPS.'/exceptions/summary'],
            ['get', self::OPS.'/exceptions/alerts'],
        ];

        foreach ($endpoints as [$method, $url]) {
            $this->{$method.'Json'}($url)->assertUnauthorized();
        }
    }

    public function test_a_user_without_the_permission_is_refused(): void
    {
        $stranger = User::factory()->create(['company_id' => $this->company->id]);

        $role = Role::create([
            'name' => 'Phase 4 Nobody',
            'slug' => 'phase4-nobody-'.$this->suffix(),
            'is_system' => false,
        ]);
        $stranger->roles()->attach($role->id);

        $this->actingAs($stranger)->getJson(self::OPS.'/pools')->assertForbidden();
    }

    /** Reserving does not grant releasing: giving capacity back is its own call. */
    public function test_reserving_does_not_grant_releasing(): void
    {
        $reserver = User::factory()->create(['company_id' => $this->company->id]);

        $role = Role::create([
            'name' => 'Phase 4 Reserver',
            'slug' => 'phase4-reserver-'.$this->suffix(),
            'is_system' => false,
        ]);
        $role->permissions()->attach(
            Permission::whereIn('name', ['operations.view', 'operations.capacity.reserve'])->pluck('id')
        );
        $reserver->roles()->attach($role->id);

        $slot = $this->makeSlot(100);

        $created = $this->actingAs($reserver)->postJson(self::OPS.'/capacity/reservations', [
            'capacity_slot_id' => $slot->uuid,
            'orders' => 5,
        ])->assertCreated();

        $this->actingAs($reserver)
            ->patchJson(self::OPS."/capacity/reservations/{$created->json('data.id')}/release", [])
            ->assertForbidden();
    }

    public function test_the_eight_phase_4_permissions_are_seeded(): void
    {
        foreach ([
            'operations.view',
            'operations.pool.manage',
            'operations.capacity.reserve',
            'operations.capacity.release',
            'operations.exception.manage',
            'operations.exception.escalate',
            'operations.alert.manage',
            'operations.audit.view',
        ] as $name) {
            $this->assertTrue(
                Permission::where('name', $name)->exists(),
                "Permission {$name} must be seeded."
            );
        }
    }

    /**
     * DIRECTIVE 3 — Phase 4 is additive. Phase 2 and Phase 3 routes are
     * untouched.
     */
    public function test_phase_2_and_3_dispatch_routes_still_answer(): void
    {
        $this->auth()->getJson('/api/logistics/dispatch/options')->assertOk();
        $this->auth()->getJson('/api/logistics/dispatch/ops/options')->assertOk();
        $this->auth()->getJson('/api/logistics/network/service-areas')->assertOk();
    }

    /**
     * DIRECTIVE 12 — one writer per table. Only Network's ledger may write a
     * capacity slot, so no Operations service may reference the column.
     */
    public function test_no_operations_service_writes_a_capacity_column(): void
    {
        $files = glob(base_path('Modules/Logistics/Operations/Domain/Services/*.php')) ?: [];

        foreach ($files as $file) {
            $source = preg_replace('#/\*.*?\*/|//[^\n]*#s', '', (string) file_get_contents($file));

            foreach (['committed_orders', 'committed_stops', 'committed_weight_kg', 'committed_volume_m3'] as $column) {
                $this->assertStringNotContainsString(
                    $column,
                    (string) $source,
                    basename($file).' must not touch '.$column.' — CapacityLedgerService is its only writer.'
                );
            }
        }
    }

    /** The ledger service is injected, not re-implemented. */
    public function test_the_reservation_service_delegates_to_the_network_ledger(): void
    {
        $source = (string) file_get_contents(
            base_path('Modules/Logistics/Operations/Domain/Services/CapacityReservationService.php')
        );

        $this->assertStringContainsString(CapacityLedgerService::class, $source);
        $this->assertStringContainsString('$this->ledger->reserve(', $source);
    }

    public function test_the_pool_view_delegates_readiness_to_dispatch_and_fleet(): void
    {
        $source = (string) file_get_contents(
            base_path('Modules/Logistics/Operations/Domain/Services/UnifiedResourcePoolService.php')
        );

        // Reuse, not a second implementation of the same composition.
        $this->assertStringContainsString('ResourcePoolService', $source);
        $this->assertStringContainsString('$this->dispatchPool->build(', $source);
        // And never Fleet's internals directly.
        $this->assertStringNotContainsString('FleetReadinessService', $source);
    }

    public function test_alert_rules_are_configuration_not_a_second_lifecycle(): void
    {
        // There is no alerts table: an alert IS an exception a rule matched.
        $this->assertFalse(
            \Illuminate\Support\Facades\Schema::hasTable('ops_alerts'),
            'A second alert table would mean two records of one problem.'
        );

        $this->assertTrue(\Illuminate\Support\Facades\Schema::hasTable('ops_alert_rules'));
        $this->assertSame(0, AlertRule::whereNull('uuid')->count());
    }
}
