<?php

declare(strict_types=1);

namespace Tests\Feature\Logistics;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Modules\IAM\Domain\Models\Permission;
use Modules\IAM\Domain\Models\Role;
use Modules\Logistics\Dispatch\Domain\Enums\AllocationStatus;
use Modules\Logistics\Dispatch\Domain\Enums\ConflictStatus;
use Modules\Logistics\Dispatch\Domain\Enums\ConflictType;
use Modules\Logistics\Dispatch\Domain\Enums\DispatchSessionStatus;
use Modules\Logistics\Dispatch\Domain\Enums\LockStatus;
use Modules\Logistics\Dispatch\Domain\Enums\QueueItemStatus;
use Modules\Logistics\Dispatch\Domain\Enums\QueuePriority;
use Modules\Logistics\Dispatch\Domain\Enums\ReviewStatus;
use Modules\Logistics\Dispatch\Domain\Models\AssignmentLock;
use Modules\Logistics\Dispatch\Domain\Models\DispatchAuditEntry;
use Modules\Logistics\Dispatch\Domain\Models\DispatchBoard;
use Modules\Logistics\Dispatch\Domain\Models\DispatchQueueItem;
use Modules\Logistics\Dispatch\Domain\Models\DispatchSession;
use Modules\Logistics\Dispatch\Domain\Models\ResourceAllocation;
use Modules\Logistics\Dispatch\Domain\Services\AssignmentLockService;
use Modules\Logistics\Dispatch\Domain\Services\DispatchMonitoringService;
use Modules\Logistics\Dispatch\Domain\Services\DispatchSessionService;
use Modules\Logistics\Distribution\Domain\Enums\TripType;
use Modules\Logistics\Distribution\Domain\Models\Trip;
use Modules\Logistics\Drivers\Domain\Models\Driver;
use Modules\Logistics\Network\Domain\Models\DispatchRegion;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * EPIC-LOG-V2-001 Phase 3 — Dispatch Operations, Execution, Allocation,
 * Monitoring.
 *
 * Covers the operational surface and the directives that constrain it:
 *
 *   • Directive 4/11/12 — reuses Fleet, Network and Drivers; duplicates none
 *   • Directive 5       — Fleet remains the readiness authority
 *   • Directive 7       — Distribution remains the execution authority
 *   • Directive 13      — one writer per table
 *   • Directive 14      — additive; Phase 2 behaviour is unchanged
 */
class Phase3ModuleTest extends TestCase
{
    use DatabaseTransactions;

    private const OPS = '/api/logistics/dispatch/ops';

    private const DISPATCH = '/api/logistics/dispatch';

    private User $user;

    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->user = User::factory()->create(['company_id' => $this->company->id]);

        $role = Role::create([
            'name' => 'Phase 3 Test Admin',
            'slug' => 'phase3-admin-'.substr(md5(uniqid('', true)), 0, 8),
            'is_system' => true,
        ]);
        $this->user->roles()->attach($role->id);
    }

    private function auth(): static
    {
        return $this->actingAs($this->user);
    }

    // ── Fixtures ──────────────────────────────────────────────────────────────

    private function makeBoard(): DispatchBoard
    {
        $region = DispatchRegion::create([
            'company_id' => $this->company->id,
            'code' => 'REG-'.substr(md5(uniqid('', true)), 0, 5),
            'name' => 'Cairo Main',
        ]);

        $response = $this->auth()->postJson(self::DISPATCH.'/boards', [
            'board_date' => now()->addDay()->toDateString(),
            'dispatch_region_id' => $region->id,
        ])->assertCreated();

        return DispatchBoard::where('uuid', $response->json('data.uuid'))->firstOrFail();
    }

    private function openSession(?DispatchBoard $board = null): DispatchSession
    {
        $board ??= $this->makeBoard();

        $response = $this->auth()->postJson(self::OPS."/boards/{$board->uuid}/sessions", [
            'mode' => DispatchSession::MODE_MANUAL,
        ])->assertCreated();

        return DispatchSession::where('uuid', $response->json('data.uuid'))->firstOrFail();
    }

    private function makeTrip(array $overrides = []): Trip
    {
        return Trip::create(array_merge([
            'company_id' => $this->company->id,
            'trip_number' => 'TRP-'.substr(md5(uniqid('', true)), 0, 6),
            'name' => 'Phase 3 Test Run',
            'type' => TripType::CompanyVehicle->value,
            'capacity' => 3,
            'status' => 'planning',
            'created_by' => $this->user->id,
        ], $overrides));
    }

    private function makeVehicle(): Vehicle
    {
        $suffix = substr(md5(uniqid('', true)), 0, 8);

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
        $suffix = substr(md5(uniqid('', true)), 0, 8);

        return Driver::create([
            'driver_code' => 'DRV-'.$suffix,
            'full_name' => 'Phase 3 Driver',
            'mobile' => '010'.substr($suffix, 0, 8),
            'national_id' => 'NID-'.$suffix,
            'license_issue_date' => '2024-01-01',
            'license_expiry_date' => '2031-01-01',
        ]);
    }

    // ═══ SESSIONS ════════════════════════════════════════════════════════════

    public function test_options_expose_every_phase_3_vocabulary(): void
    {
        $this->auth()->getJson(self::OPS.'/options')
            ->assertOk()
            ->assertJsonCount(5, 'session_statuses')
            ->assertJsonCount(3, 'session_modes')
            ->assertJsonCount(7, 'queue_statuses')
            ->assertJsonCount(4, 'queue_priorities')
            ->assertJsonCount(5, 'allocation_statuses')
            ->assertJsonCount(8, 'conflict_types')
            ->assertJsonCount(5, 'conflict_statuses')
            ->assertJsonCount(4, 'review_statuses')
            ->assertJsonCount(4, 'lock_statuses');
    }

    public function test_a_session_opens_and_records_its_operator(): void
    {
        $board = $this->makeBoard();

        $this->auth()->postJson(self::OPS."/boards/{$board->uuid}/sessions", [])
            ->assertCreated()
            ->assertJsonPath('data.status', DispatchSessionStatus::Open->value)
            ->assertJsonPath('data.is_active', true)
            ->assertJsonPath('data.operator_id', $this->user->id);
    }

    /** Two sessions by the same operator would split the audit trail. */
    public function test_an_operator_cannot_open_two_sessions_on_a_board(): void
    {
        $board = $this->makeBoard();

        $this->auth()->postJson(self::OPS."/boards/{$board->uuid}/sessions", [])->assertCreated();

        $this->auth()->postJson(self::OPS."/boards/{$board->uuid}/sessions", [])
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'already has an open session'));
    }

    public function test_an_illegal_session_transition_is_refused(): void
    {
        $session = $this->openSession();

        $this->auth()->patchJson(self::OPS."/sessions/{$session->uuid}/status", [
            'status' => DispatchSessionStatus::Closed->value,
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'cannot move from Open to Closed'));
    }

    /**
     * A finished session must not keep holding resources — otherwise a closed
     * laptop removes a vehicle from the pool for the rest of the day.
     */
    public function test_closing_a_session_releases_every_lock_it_holds(): void
    {
        $session = $this->openSession();
        $vehicle = $this->makeVehicle();
        $locks = app(AssignmentLockService::class);

        $locks->acquire($session, AssignmentLock::RESOURCE_VEHICLE, $vehicle->id);
        $this->assertTrue($locks->isLocked(AssignmentLock::RESOURCE_VEHICLE, $vehicle->id));

        $this->auth()->patchJson(self::OPS."/sessions/{$session->uuid}/close", [
            'reason' => 'End of shift.',
        ])->assertOk()->assertJsonPath('data.status', DispatchSessionStatus::Closed->value);

        $this->assertFalse($locks->isLocked(AssignmentLock::RESOURCE_VEHICLE, $vehicle->id));
    }

    // ═══ LOCKS ═══════════════════════════════════════════════════════════════

    /**
     * THE MUTUAL-EXCLUSION INVARIANT, enforced by a unique index rather than
     * by application care.
     */
    public function test_only_one_session_can_hold_a_resource(): void
    {
        $board = $this->makeBoard();
        $first = $this->openSession($board);
        $vehicle = $this->makeVehicle();
        $locks = app(AssignmentLockService::class);

        $locks->acquire($first, AssignmentLock::RESOURCE_VEHICLE, $vehicle->id);

        // A second operator, a second session, the same vehicle.
        $other = User::factory()->create(['company_id' => $this->company->id]);
        $second = app(DispatchSessionService::class)->open(
            $board,
            DispatchSession::MODE_MANUAL,
            $other->id,
            'Second Operator',
        );

        $this->expectExceptionMessageMatches('/is held by/');
        $locks->acquire($second, AssignmentLock::RESOURCE_VEHICLE, $vehicle->id);
    }

    public function test_the_unique_index_enforces_one_live_lock_per_resource(): void
    {
        $indexes = collect(DB::select('SHOW INDEX FROM dispatch_assignment_locks'))
            ->groupBy('Key_name');

        $this->assertTrue(
            $indexes->has('dispatch_lock_one_live_unique'),
            'The mutual-exclusion invariant must be a database constraint, not application care.',
        );

        $columns = $indexes->get('dispatch_lock_one_live_unique')->pluck('Column_name')->all();
        $this->assertSame(['resource_type', 'resource_id', 'active_flag'], $columns);
    }

    /** An expired hold must not block a live dispatcher. */
    public function test_an_expired_lock_is_reclaimed_and_no_longer_blocks(): void
    {
        $session = $this->openSession();
        $vehicle = $this->makeVehicle();
        $locks = app(AssignmentLockService::class);

        $lock = $locks->acquire($session, AssignmentLock::RESOURCE_VEHICLE, $vehicle->id);

        DB::table('dispatch_assignment_locks')
            ->where('id', $lock->id)
            ->update(['expires_at' => now()->subHour()]);

        $this->assertFalse($locks->isLocked(AssignmentLock::RESOURCE_VEHICLE, $vehicle->id));
        $this->assertSame(1, $locks->sweepExpired());
        $this->assertSame(LockStatus::Expired, $lock->refresh()->status);
    }

    /** Partial acquisition strands resources nobody can use. */
    public function test_acquiring_a_set_is_all_or_nothing(): void
    {
        $board = $this->makeBoard();
        $mine = $this->openSession($board);
        $vehicle = $this->makeVehicle();
        $driver = $this->makeDriver();
        $locks = app(AssignmentLockService::class);

        // Someone else already holds the driver.
        $other = User::factory()->create(['company_id' => $this->company->id]);
        $theirs = app(DispatchSessionService::class)->open(
            $board, DispatchSession::MODE_MANUAL, $other->id, 'Other',
        );
        $locks->acquire($theirs, AssignmentLock::RESOURCE_DRIVER, $driver->id);

        try {
            $locks->acquireMany($mine, [
                [AssignmentLock::RESOURCE_VEHICLE, $vehicle->id],
                [AssignmentLock::RESOURCE_DRIVER, $driver->id],
            ]);
            $this->fail('Expected the set acquisition to fail.');
        } catch (\Throwable) {
            // The vehicle we DID get must have been handed back.
            $held = $locks->currentHolder(AssignmentLock::RESOURCE_VEHICLE, $vehicle->id);
            $this->assertNull($held, 'A failed set left a resource stranded.');
        }
    }

    /** Force-releasing a colleague's lock always needs a reason and is audited. */
    public function test_breaking_a_lock_requires_a_reason_and_is_audited(): void
    {
        $session = $this->openSession();
        $vehicle = $this->makeVehicle();
        $lock = app(AssignmentLockService::class)
            ->acquire($session, AssignmentLock::RESOURCE_VEHICLE, $vehicle->id);

        $this->auth()->patchJson(self::OPS."/locks/{$lock->uuid}/break", [])->assertStatus(422);

        $this->auth()->patchJson(self::OPS."/locks/{$lock->uuid}/break", [
            'reason' => 'Operator went home without releasing.',
        ])->assertOk();

        $this->assertSame(LockStatus::Broken, $lock->refresh()->status);
        $this->assertSame(
            1,
            DispatchAuditEntry::where('action', DispatchAuditEntry::ACTION_LOCK_BROKEN)->count(),
        );
    }

    // ═══ QUEUE ═══════════════════════════════════════════════════════════════

    public function test_the_queue_is_built_from_unassigned_trips_and_is_idempotent(): void
    {
        $board = $this->makeBoard();
        $this->makeTrip();
        $this->makeTrip();

        $first = $this->auth()->postJson(self::OPS."/boards/{$board->uuid}/queue/build")->assertOk();
        $this->assertGreaterThanOrEqual(2, $first->json('added'));

        // Re-running adds nothing — a board can be refreshed mid-morning.
        $this->auth()->postJson(self::OPS."/boards/{$board->uuid}/queue/build")
            ->assertOk()
            ->assertJsonPath('added', 0);
    }

    public function test_claiming_moves_an_item_and_records_the_session(): void
    {
        $board = $this->makeBoard();
        $this->makeTrip();
        $session = $this->openSession($board);

        $this->auth()->postJson(self::OPS."/boards/{$board->uuid}/queue/build")->assertOk();

        $claimed = $this->auth()
            ->postJson(self::OPS."/sessions/{$session->uuid}/queue/claim-next")
            ->assertOk();

        $claimed->assertJsonPath('data.status', QueueItemStatus::Claimed->value);
        $this->assertSame($session->uuid, $claimed->json('data.claimed_by_session_id'));
    }

    /** Ordering must be explainable, so prioritising demands a reason. */
    public function test_prioritising_requires_a_reason_and_changes_rank(): void
    {
        $board = $this->makeBoard();
        $this->makeTrip();
        $this->auth()->postJson(self::OPS."/boards/{$board->uuid}/queue/build")->assertOk();

        $item = DispatchQueueItem::where('dispatch_board_id', $board->id)->firstOrFail();

        $this->auth()->patchJson(self::OPS."/queue/{$item->uuid}/priority", [
            'priority' => QueuePriority::Critical->value,
        ])->assertStatus(422);

        $response = $this->auth()->patchJson(self::OPS."/queue/{$item->uuid}/priority", [
            'priority' => QueuePriority::Critical->value,
            'reason' => 'VIP customer escalation.',
        ])->assertOk();

        $response->assertJsonPath('data.priority', QueuePriority::Critical->value);
        $this->assertSame('VIP customer escalation.', $response->json('data.priority_reason'));
        // Critical outranks everything.
        $this->assertLessThan(1000, $response->json('data.rank'));
    }

    /** Ageing prevents starvation — the bottom of the queue must move. */
    public function test_rank_ages_so_low_priority_items_do_not_starve(): void
    {
        $board = $this->makeBoard();
        $this->makeTrip();
        $this->auth()->postJson(self::OPS."/boards/{$board->uuid}/queue/build")->assertOk();

        $item = DispatchQueueItem::where('dispatch_board_id', $board->id)->firstOrFail();
        $freshRank = $item->computeRank();

        // Same item, two hours older.
        $item->queued_at = now()->subHours(2);
        $agedRank = $item->computeRank();

        $this->assertLessThan($freshRank, $agedRank, 'Waiting did not improve rank.');
    }

    public function test_an_illegal_queue_transition_is_refused(): void
    {
        $board = $this->makeBoard();
        $this->makeTrip();
        $this->auth()->postJson(self::OPS."/boards/{$board->uuid}/queue/build")->assertOk();

        $item = DispatchQueueItem::where('dispatch_board_id', $board->id)->firstOrFail();
        $item->update(['status' => QueueItemStatus::Completed->value]);

        $this->auth()->patchJson(self::OPS."/queue/{$item->uuid}/defer", [])
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'cannot move from Completed'));
    }

    // ═══ ALLOCATION AND CONFLICTS ════════════════════════════════════════════

    public function test_allocating_locks_resources_and_records_the_fleet_verdict(): void
    {
        $session = $this->openSession();
        $trip = $this->makeTrip();
        $vehicle = $this->makeVehicle();
        $driver = $this->makeDriver();

        $response = $this->auth()->postJson(self::OPS."/sessions/{$session->uuid}/allocate", [
            'trip_id' => $trip->uuid,
            'vehicle_id' => $vehicle->id,
            'driver_id' => $driver->id,
        ])->assertCreated();

        $response->assertJsonPath('data.status', AllocationStatus::Proposed->value);
        // Fleet's verdict is SNAPSHOTTED, not recomputed by Dispatch.
        $this->assertNotNull($response->json('data.fleet_verdict'));

        $locks = app(AssignmentLockService::class);
        $this->assertTrue($locks->isLocked(AssignmentLock::RESOURCE_VEHICLE, $vehicle->id));
        $this->assertTrue($locks->isLocked(AssignmentLock::RESOURCE_DRIVER, $driver->id));
    }

    /** Double-booking is detected, and the conflict names its authority. */
    public function test_double_booking_a_vehicle_raises_a_blocking_conflict(): void
    {
        $board = $this->makeBoard();
        $session = $this->openSession($board);
        $vehicle = $this->makeVehicle();
        $driver = $this->makeDriver();

        $first = $this->auth()->postJson(self::OPS."/sessions/{$session->uuid}/allocate", [
            'trip_id' => $this->makeTrip()->uuid,
            'vehicle_id' => $vehicle->id,
            'driver_id' => $driver->id,
        ])->assertCreated();

        // Reserve it so the second allocation genuinely contends.
        ResourceAllocation::where('uuid', $first->json('data.id'))
            ->update(['status' => AllocationStatus::Reserved->value]);

        $second = $this->auth()->postJson(self::OPS."/sessions/{$session->uuid}/allocate", [
            'trip_id' => $this->makeTrip()->uuid,
            'vehicle_id' => $vehicle->id,
            'driver_id' => $driver->id,
        ])->assertCreated();

        $conflicts = collect($second->json('data.conflicts'));
        $this->assertNotEmpty($conflicts);
        $this->assertTrue($conflicts->contains('is_blocking', true));
    }

    public function test_confirming_is_refused_while_a_blocking_conflict_stands(): void
    {
        $session = $this->openSession();
        $vehicle = $this->makeVehicle();
        $driver = $this->makeDriver();

        // A trip Distribution already assigned — TripAlreadyAssigned, blocking.
        $trip = $this->makeTrip(['driver_vehicle_assignment_id' => null]);
        $allocation = $this->auth()->postJson(self::OPS."/sessions/{$session->uuid}/allocate", [
            'trip_id' => $trip->uuid,
            'vehicle_id' => $vehicle->id,
            'driver_id' => $driver->id,
        ])->assertCreated();

        // Force a blocking conflict.
        \Modules\Logistics\Dispatch\Domain\Models\DispatchConflict::create([
            'company_id' => $this->company->id,
            'allocation_id' => ResourceAllocation::where('uuid', $allocation->json('data.id'))->value('id'),
            'conflict_type' => ConflictType::VehicleDoubleBooked->value,
            'severity' => 'blocking',
            'status' => ConflictStatus::Open->value,
            'description' => 'That vehicle is already allocated.',
            'detected_at' => now(),
        ]);

        $this->auth()->patchJson(self::OPS."/allocations/{$allocation->json('data.id')}/confirm")
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'Blocking conflicts'));
    }

    /**
     * DIRECTIVE 5/7 — Dispatch may not overrule another authority's fact.
     *
     * A vehicle Fleet calls unfit is a safety matter and must be cleared where
     * it lives, not waved through from the dispatch board.
     */
    public function test_dispatch_cannot_override_another_modules_conflict(): void
    {
        $session = $this->openSession();

        $conflict = \Modules\Logistics\Dispatch\Domain\Models\DispatchConflict::create([
            'company_id' => $this->company->id,
            'dispatch_session_id' => $session->id,
            'conflict_type' => ConflictType::VehicleUnfit->value,
            'severity' => 'blocking',
            'status' => ConflictStatus::Open->value,
            'description' => 'Fleet reports this vehicle unfit: brake inspection lapsed.',
            'detected_at' => now(),
        ]);

        $this->assertSame('fleet', $conflict->authority());

        $this->auth()->patchJson(self::OPS."/conflicts/{$conflict->uuid}/override", [
            'reason' => 'We need the van today.',
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'owned by fleet'));
    }

    /** A conflict Dispatch DOES own may be overridden — with a reason, audited. */
    public function test_a_dispatch_owned_conflict_can_be_overridden_with_a_reason(): void
    {
        $session = $this->openSession();

        $conflict = \Modules\Logistics\Dispatch\Domain\Models\DispatchConflict::create([
            'company_id' => $this->company->id,
            'dispatch_session_id' => $session->id,
            'conflict_type' => ConflictType::PolicyViolation->value,
            'severity' => 'advisory',
            'status' => ConflictStatus::Open->value,
            'description' => 'Assignment breaches the preferred-vehicle policy.',
            'detected_at' => now(),
        ]);

        $this->assertSame('dispatch', $conflict->authority());

        $this->auth()->patchJson(self::OPS."/conflicts/{$conflict->uuid}/override", [])
            ->assertStatus(422);

        $this->auth()->patchJson(self::OPS."/conflicts/{$conflict->uuid}/override", [
            'reason' => 'Preferred vehicle is in for service; supervisor approved.',
        ])->assertOk()->assertJsonPath('data.status', ConflictStatus::Overridden->value);

        $this->assertSame(
            1,
            DispatchAuditEntry::where('action', DispatchAuditEntry::ACTION_CONFLICT_OVERRIDDEN)->count(),
        );
    }

    /**
     * DIRECTIVE 4/11/12 — allocation RECORDS other modules' verdicts and
     * duplicates none of their logic.
     */
    public function test_allocation_reuses_authorities_and_duplicates_no_logic(): void
    {
        $columns = Schema::getColumnListing('dispatch_resource_allocations');

        // Snapshots and receipts only — never the inputs that produced them.
        $this->assertContains('fleet_verdict', $columns);
        $this->assertContains('capacity_commitment_uuid', $columns);

        foreach ([
            'available_orders', 'committed_orders', 'defect_count',
            'licence_expiry', 'maintenance_due', 'plate_number', 'driver_name',
        ] as $forbidden) {
            $this->assertNotContains(
                $forbidden,
                $columns,
                "dispatch_resource_allocations must not duplicate {$forbidden}",
            );
        }

        $source = preg_replace(
            '#/\*.*?\*/|//[^\n]*#s',
            '',
            file_get_contents(base_path(
                'Modules/Logistics/Dispatch/Domain/Services/ResourceAllocationService.php'
            )),
        );

        // Reuses the authorities...
        $this->assertStringContainsString('FleetReadinessQueryInterface', $source);
        $this->assertStringContainsString('CapacityLedgerService', $source);

        // ...and writes none of their tables itself.
        foreach ([
            "table('fleet_units')",
            "table('network_capacity_slots')",
            "table('logistics_vehicles')",
            "table('distribution_trips')",
        ] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $source);
        }
    }

    // ═══ REVIEW ══════════════════════════════════════════════════════════════

    /** Separation of duties on risk decisions — the LOG-005 precedent. */
    public function test_a_conflict_review_cannot_be_decided_by_its_requester(): void
    {
        $board = $this->makeBoard();
        $this->makeTrip();
        $session = $this->openSession($board);

        $proposal = $this->auth()->postJson(self::DISPATCH."/boards/{$board->uuid}/propose")
            ->assertCreated();
        $assignmentId = $proposal->json('data.assignments.0.id');
        $this->assertNotNull($assignmentId);

        $review = $this->auth()->postJson(self::OPS."/assignments/{$assignmentId}/review", [
            'trigger' => \Modules\Logistics\Dispatch\Domain\Models\AssignmentReview::TRIGGER_CONFLICT,
            'trigger_reason' => 'Vehicle contended.',
            'session_id' => $session->uuid,
        ])->assertCreated();

        $reviewId = $review->json('data.id');

        // Same user requested it — refused.
        $this->auth()->patchJson(self::OPS."/reviews/{$reviewId}/approve")
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'other than'));

        // A different approver succeeds.
        $approver = User::factory()->create(['company_id' => $this->company->id]);
        $approver->roles()->attach($this->user->roles()->first()->id);

        $this->actingAs($approver)
            ->patchJson(self::OPS."/reviews/{$reviewId}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', ReviewStatus::Approved->value);
    }

    public function test_rejecting_a_review_requires_a_reason(): void
    {
        $board = $this->makeBoard();
        $this->makeTrip();
        $session = $this->openSession($board);

        $proposal = $this->auth()->postJson(self::DISPATCH."/boards/{$board->uuid}/propose")
            ->assertCreated();
        $assignmentId = $proposal->json('data.assignments.0.id');

        $review = $this->auth()->postJson(self::OPS."/assignments/{$assignmentId}/review", [
            // Automatic trigger — self-decidable, so the reason rule is what is
            // being tested rather than the approver rule.
            'trigger' => \Modules\Logistics\Dispatch\Domain\Models\AssignmentReview::TRIGGER_AUTOMATIC,
            'session_id' => $session->uuid,
        ])->assertCreated();

        $this->auth()->patchJson(self::OPS."/reviews/{$review->json('data.id')}/reject", [])
            ->assertStatus(422);

        $this->auth()->patchJson(self::OPS."/reviews/{$review->json('data.id')}/reject", [
            'reason' => 'Wrong vehicle class for this route.',
        ])->assertOk()->assertJsonPath('data.status', ReviewStatus::Rejected->value);
    }

    public function test_only_one_review_can_be_open_per_assignment(): void
    {
        $board = $this->makeBoard();
        $this->makeTrip();
        $this->openSession($board);

        $proposal = $this->auth()->postJson(self::DISPATCH."/boards/{$board->uuid}/propose")
            ->assertCreated();
        $assignmentId = $proposal->json('data.assignments.0.id');

        $payload = ['trigger' => 'automatic'];

        $this->auth()->postJson(self::OPS."/assignments/{$assignmentId}/review", $payload)
            ->assertCreated();

        $this->auth()->postJson(self::OPS."/assignments/{$assignmentId}/review", $payload)
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'already has an open review'));
    }

    // ═══ AUDIT ═══════════════════════════════════════════════════════════════

    /** An audit trail that can be edited is not an audit trail. */
    public function test_the_audit_trail_is_append_only(): void
    {
        $session = $this->openSession();

        $entry = DispatchAuditEntry::where('dispatch_session_id', $session->id)->firstOrFail();
        $originalAction = $entry->action;

        $entry->action = 'tampered';
        $entry->save();
        $entry->delete();

        $fresh = DispatchAuditEntry::find($entry->id);
        $this->assertNotNull($fresh, 'An audit entry was deleted.');
        $this->assertSame($originalAction, $fresh->action, 'An audit entry was modified.');
    }

    /** An override with no explanation must be impossible to record. */
    public function test_an_action_requiring_a_reason_cannot_be_recorded_without_one(): void
    {
        $audit = app(\Modules\Logistics\Dispatch\Domain\Services\DispatchAuditService::class);

        $this->expectExceptionMessageMatches('/without a reason/');
        $audit->record(action: DispatchAuditEntry::ACTION_OVERRIDDEN);
    }

    public function test_the_audit_endpoint_can_filter_to_overrides(): void
    {
        $session = $this->openSession();
        $vehicle = $this->makeVehicle();
        $lock = app(AssignmentLockService::class)
            ->acquire($session, AssignmentLock::RESOURCE_VEHICLE, $vehicle->id);

        $this->auth()->patchJson(self::OPS."/locks/{$lock->uuid}/break", [
            'reason' => 'Stale hold.',
        ])->assertOk();

        $overrides = $this->auth()->getJson(self::OPS.'/audit?overrides_only=1')->assertOk();

        $this->assertNotEmpty($overrides->json('data'));
        foreach ($overrides->json('data') as $entry) {
            $this->assertTrue($entry['is_override']);
            $this->assertNotNull($entry['reason']);
        }
    }

    // ═══ MONITORING ══════════════════════════════════════════════════════════

    /** A rate computed from no data is NULL, never zero. */
    public function test_kpis_return_null_rates_rather_than_misleading_zeros(): void
    {
        $kpis = $this->auth()->getJson(self::OPS.'/monitoring/kpis')->assertOk();

        $this->assertNull($kpis->json('data.confirmation_rate'));
        $this->assertNull($kpis->json('data.automatic_share'));
        $this->assertSame(0, $kpis->json('data.allocations_attempted'));
    }

    public function test_queue_statistics_report_depth_ageing_and_stuck_items(): void
    {
        $board = $this->makeBoard();
        $this->makeTrip();
        $this->auth()->postJson(self::OPS."/boards/{$board->uuid}/queue/build")->assertOk();

        $stats = $this->auth()->getJson(self::OPS.'/monitoring/queue')->assertOk();

        $this->assertGreaterThanOrEqual(1, $stats->json('data.depth'));
        $this->assertIsArray($stats->json('data.by_status'));
        $this->assertIsArray($stats->json('data.by_priority'));
        $this->assertSame(0, $stats->json('data.stuck'));
    }

    /** Health reports WHICH module owns the outstanding problems. */
    public function test_assignment_health_groups_conflicts_by_owning_authority(): void
    {
        $session = $this->openSession();

        \Modules\Logistics\Dispatch\Domain\Models\DispatchConflict::create([
            'company_id' => $this->company->id,
            'dispatch_session_id' => $session->id,
            'conflict_type' => ConflictType::VehicleUnfit->value,
            'severity' => 'blocking',
            'status' => ConflictStatus::Open->value,
            'description' => 'Fleet reports this vehicle unfit.',
            'detected_at' => now(),
        ]);

        $health = $this->auth()->getJson(self::OPS.'/monitoring/health')->assertOk();

        $this->assertSame(1, $health->json('data.open_conflicts'));
        $this->assertSame(1, $health->json('data.blocking_conflicts'));
        $this->assertSame(1, $health->json('data.conflicts_by_authority.fleet'));
    }

    /** Capacity utilisation READS Network; Dispatch computes nothing. */
    public function test_capacity_utilisation_reads_network_and_computes_nothing(): void
    {
        $this->auth()->getJson(self::OPS.'/monitoring/capacity')
            ->assertOk()
            ->assertJsonStructure(['data' => ['date', 'slot_count', 'avg_utilisation', 'by_area']]);

        $source = preg_replace(
            '#/\*.*?\*/|//[^\n]*#s',
            '',
            file_get_contents(base_path(
                'Modules/Logistics/Dispatch/Domain/Services/DispatchMonitoringService.php'
            )),
        );

        // No capacity arithmetic here — it calls the slot's own accessors.
        $this->assertStringNotContainsString('available_orders -', $source);
        $this->assertStringNotContainsString('committed_orders +', $source);
    }

    public function test_the_exception_dashboard_aggregates_what_needs_a_human(): void
    {
        $this->auth()->getJson(self::OPS.'/monitoring/exceptions')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'blocking_conflicts', 'pending_reviews', 'blocked_queue_items',
                    'stuck_queue_items', 'abandoned_sessions', 'conflicts_by_authority',
                ],
            ]);
    }

    /** Monitoring is operational only — no prediction (Phase 3 scope). */
    public function test_monitoring_contains_no_predictive_logic(): void
    {
        // Scan CODE only — a comment saying "no prediction here" is the point,
        // not a violation.
        $code = strtolower(preg_replace(
            '#/\*.*?\*/|//[^\n]*#s',
            '',
            file_get_contents(base_path(
                'Modules/Logistics/Dispatch/Domain/Services/DispatchMonitoringService.php'
            )),
        ));

        foreach (['forecast', 'predict', 'regression', 'trainmodel'] as $token) {
            $this->assertStringNotContainsString($token, $code);
        }
    }

    // ═══ TIMELINE ════════════════════════════════════════════════════════════

    public function test_the_board_timeline_records_the_narrative(): void
    {
        $board = $this->makeBoard();
        $this->openSession($board);

        $timeline = $this->auth()->getJson(self::OPS."/boards/{$board->uuid}/timeline")->assertOk();

        $events = collect($timeline->json('data'));
        $this->assertNotEmpty($events);
        $this->assertTrue($events->contains('event_type', 'session.opened'));
    }

    // ═══ ADDITIVITY AND AUTHORIZATION ════════════════════════════════════════

    /** DIRECTIVE 14 — Phase 2 behaviour is unchanged. */
    public function test_phase_2_dispatch_endpoints_still_behave_identically(): void
    {
        $this->auth()->getJson(self::DISPATCH.'/options')
            ->assertOk()
            ->assertJsonCount(8, 'board_statuses')
            ->assertJsonCount(4, 'proposal_statuses')
            ->assertJsonCount(6, 'assignment_statuses');

        $board = $this->makeBoard();
        $this->auth()->getJson(self::DISPATCH."/boards/{$board->uuid}")->assertOk();
        $this->auth()->getJson(self::DISPATCH.'/resource-pool')->assertOk();
    }

    /** Phase 3 added tables only — no Phase 2 table was altered. */
    public function test_phase_2_dispatch_tables_are_unchanged(): void
    {
        // The Phase 2 assignment table keeps exactly its original shape.
        $columns = Schema::getColumnListing('dispatch_proposed_assignments');

        foreach ([
            'uuid', 'dispatch_proposal_id', 'trip_id', 'vehicle_id', 'driver_id',
            'status', 'score', 'score_breakdown', 'fitness_level',
        ] as $expected) {
            $this->assertContains($expected, $columns);
        }

        // Phase 3 did not bolt session or lock columns onto it.
        foreach (['dispatch_session_id', 'lock_id', 'review_id'] as $notExpected) {
            $this->assertNotContains($notExpected, $columns);
        }
    }

    public function test_every_phase_3_endpoint_requires_authentication(): void
    {
        $this->getJson(self::OPS.'/sessions')->assertUnauthorized();
        $this->getJson(self::OPS.'/conflicts')->assertUnauthorized();
        $this->getJson(self::OPS.'/monitoring/kpis')->assertUnauthorized();
        $this->getJson(self::OPS.'/audit')->assertUnauthorized();
    }

    public function test_a_user_without_the_permission_is_refused(): void
    {
        $stranger = User::factory()->create(['company_id' => $this->company->id]);

        $this->actingAsUnprivileged($stranger)->getJson(self::OPS.'/sessions')->assertForbidden();
        $this->actingAsUnprivileged($stranger)->getJson(self::OPS.'/monitoring/kpis')->assertForbidden();
        $this->actingAsUnprivileged($stranger)->getJson(self::OPS.'/audit')->assertForbidden();
    }

    /** Reviewing does not grant approving. */
    public function test_requesting_a_review_does_not_grant_approving_it(): void
    {
        $requester = User::factory()->create(['company_id' => $this->company->id]);
        $role = Role::create([
            'name' => 'Dispatch Reviewer',
            'slug' => 'dispatch-reviewer-'.substr(md5(uniqid('', true)), 0, 8),
            'is_system' => false,
        ]);
        $role->permissions()->attach(
            Permission::whereIn('name', ['dispatch.view', 'dispatch.assignment.review'])->pluck('id')
        );
        $requester->roles()->attach($role->id);

        $this->actingAs($requester)->getJson(self::OPS.'/reviews/pending')->assertOk();

        $this->actingAs($requester)
            ->patchJson(self::OPS.'/reviews/'.Str::uuid().'/approve')
            ->assertForbidden();
    }

    public function test_the_eight_phase_3_permissions_are_seeded(): void
    {
        foreach ([
            'dispatch.session.manage', 'dispatch.queue.manage',
            'dispatch.assignment.review', 'dispatch.assignment.approve',
            'dispatch.assignment.override', 'dispatch.conflict.resolve',
            'dispatch.audit.view', 'dispatch.monitoring.view',
        ] as $name) {
            $this->assertTrue(
                Permission::where('name', $name)->exists(),
                "Permission {$name} was not seeded",
            );
        }

        // And the four Phase 2 permissions still exist, untouched.
        foreach (['dispatch.view', 'dispatch.propose', 'dispatch.release', 'dispatch.manage'] as $name) {
            $this->assertTrue(Permission::where('name', $name)->exists());
        }
    }
}
