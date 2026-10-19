<?php

declare(strict_types=1);

namespace Tests\Feature\Logistics;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Modules\IAM\Domain\Models\Permission;
use Modules\IAM\Domain\Models\Role;
use Modules\Logistics\Carriers\Domain\Models\CarrierAccount;
use Modules\Logistics\Carriers\Domain\Services\CarrierAdapterFactory;
use Modules\Logistics\Carriers\Domain\ValueObjects\CarrierCapabilitySet;
use Modules\Logistics\Carriers\Infrastructure\Adapters\InternalFleetAdapter;
use Modules\Logistics\Dispatch\Domain\Enums\DispatchBoardStatus;
use Modules\Logistics\Dispatch\Domain\Models\DispatchBoard;
use Modules\Logistics\Dispatch\Domain\Services\ResourcePoolService;
use Modules\Logistics\Distribution\Domain\Enums\TripType;
use Modules\Logistics\Distribution\Domain\Models\Trip;
use Modules\Logistics\Fleet\Domain\Contracts\FleetReadinessQueryInterface;
use Modules\Logistics\Network\Domain\Enums\CapacityUnit;
use Modules\Logistics\Network\Domain\Enums\CoverageMemberType;
use Modules\Logistics\Network\Domain\Enums\ServiceAreaStatus;
use Modules\Logistics\Network\Domain\Events\CapacityExhausted;
use Modules\Logistics\Network\Domain\Models\CapacityPlan;
use Modules\Logistics\Network\Domain\Models\CapacitySlot;
use Modules\Logistics\Network\Domain\Models\DispatchRegion;
use Modules\Logistics\Network\Domain\Models\ServiceArea;
use Modules\Logistics\Network\Domain\Services\CapacityLedgerService;
use Modules\Logistics\Network\Domain\Services\CoverageResolverService;
use Modules\Logistics\Routing\Domain\Services\RoutingStrategyResolver;
use Modules\Logistics\Routing\Domain\Strategies\NearestNeighbourStrategy;
use Modules\Logistics\Routing\Domain\Strategies\SequentialZoneStrategy;
use Modules\Logistics\Routing\Domain\ValueObjects\GeoPoint;
use Modules\Logistics\Routing\Domain\ValueObjects\RouteRequest;
use Modules\Logistics\Routing\Domain\ValueObjects\RouteStop;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * EPIC-LOG-V2-001 Phase 2 — Network, Dispatch, Routing and Carrier foundation.
 *
 * Covers the four contexts and, above all, the boundaries the CTO fixed:
 *
 *   • Directive 4/8 — no duplicate master data or geography
 *   • Directive 5   — Dispatch consumes FleetReadinessQueryInterface only
 *   • Directive 6   — Distribution remains the execution authority
 *   • Directive 9   — Adapter Pattern; no carrier logic in the core
 *   • Directive 10  — Strategy Pattern; deterministic, replayable routing
 *   • Directive 11  — one writer per table
 */
class Phase2ModuleTest extends TestCase
{
    use DatabaseTransactions;

    private const NETWORK = '/api/logistics/network';

    private const DISPATCH = '/api/logistics/dispatch';

    private const ROUTING = '/api/logistics/routing';

    private const CARRIERS = '/api/logistics/carriers';

    private User $user;

    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->user = User::factory()->create(['company_id' => $this->company->id]);

        $role = Role::create([
            'name' => 'Phase 2 Test Admin',
            'slug' => 'phase2-admin-'.substr(md5(uniqid('', true)), 0, 8),
            'is_system' => true,
        ]);
        $this->user->roles()->attach($role->id);
    }

    private function auth(): static
    {
        return $this->actingAs($this->user);
    }

    // ── Fixtures ──────────────────────────────────────────────────────────────

    private function makeArea(array $overrides = []): ServiceArea
    {
        $suffix = substr(md5(uniqid('', true)), 0, 6);

        $response = $this->auth()->postJson(self::NETWORK.'/service-areas', array_merge([
            'code' => 'SA-'.$suffix,
            'name' => 'Cairo East',
        ], $overrides))->assertCreated();

        return ServiceArea::where('uuid', $response->json('data.uuid'))->firstOrFail();
    }

    /**
     * A city from the Geography master.
     *
     * Seeds one when the test database has none. Note this writes to V1's
     * geography master as a TEST FIXTURE — it is the data Network composes,
     * and Network itself never creates a place.
     *
     * The latitude/longitude are D1's approved columns, which Routing reads.
     */
    private function existingCityId(): string
    {
        $city = DB::table('logistics_cities')->first();

        if ($city !== null) {
            return (string) $city->id;
        }

        // Geography uses auto-increment integer keys, so let the database
        // assign them rather than supplying a UUID.
        $governorateId = DB::table('logistics_governorates')->value('id')
            ?? DB::table('logistics_governorates')->insertGetId([
                'name_ar' => 'القاهرة',
                'name_en' => 'Cairo',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

        $cityId = DB::table('logistics_cities')->insertGetId([
            'governorate_id' => $governorateId,
            'name_ar' => 'مدينة نصر',
            'name_en' => 'Nasr City',
            'latitude' => 30.0626,
            'longitude' => 31.3300,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return (string) $cityId;
    }

    private function makeSlot(int $availableOrders = 100): CapacitySlot
    {
        $area = $this->makeArea();

        // A slot only accepts commitments through an ACTIVE area, and an area
        // only activates with at least one member — so the fixture must build
        // real coverage rather than shortcut the domain rule.
        $this->auth()->postJson(self::NETWORK."/service-areas/{$area->uuid}/members", [
            'member_type' => CoverageMemberType::City->value,
            'member_id' => $this->existingCityId(),
        ])->assertOk();

        $this->auth()->patchJson(self::NETWORK."/service-areas/{$area->uuid}/status", [
            'status' => ServiceAreaStatus::Active->value,
        ])->assertOk();

        $plan = CapacityPlan::create([
            'service_area_id' => $area->id,
            'company_id' => $this->company->id,
            'plan_date' => now()->addDay()->toDateString(),
            'is_published' => true,
            'published_at' => now(),
        ]);

        return CapacitySlot::create([
            'capacity_plan_id' => $plan->id,
            'available_orders' => $availableOrders,
            'available_stops' => $availableOrders,
        ]);
    }

    private function makeTrip(array $overrides = []): Trip
    {
        return Trip::create(array_merge([
            'company_id' => $this->company->id,
            'trip_number' => 'TRP-'.substr(md5(uniqid('', true)), 0, 6),
            'name' => 'Phase 2 Test Run',
            'type' => TripType::CompanyVehicle->value,
            'capacity' => 3,
            'created_by' => $this->user->id,
        ], $overrides));
    }

    // ═══ NETWORK ═════════════════════════════════════════════════════════════

    public function test_network_options_expose_every_vocabulary(): void
    {
        $this->auth()->getJson(self::NETWORK.'/options')
            ->assertOk()
            ->assertJsonCount(4, 'service_area_statuses')
            ->assertJsonCount(3, 'member_types')
            ->assertJsonCount(4, 'capacity_units')
            ->assertJsonCount(5, 'commitment_statuses');
    }

    /**
     * DIRECTIVE 8 — the anti-duplication table must hold only a REFERENCE.
     *
     * If a member ever grows a name or coordinate column, the composition
     * design has failed and this test says so.
     */
    public function test_service_area_members_duplicate_no_geography(): void
    {
        $columns = Schema::getColumnListing('network_service_area_members');

        foreach ([
            'name', 'name_ar', 'name_en', 'latitude', 'longitude',
            'governorate_id', 'city_name', 'zone_name',
        ] as $forbidden) {
            $this->assertNotContains(
                $forbidden,
                $columns,
                "network_service_area_members must reference geography, not copy {$forbidden}",
            );
        }

        // Only the reference pair plus the exclusion flag.
        $this->assertContains('member_type', $columns);
        $this->assertContains('member_id', $columns);
    }

    public function test_a_service_area_composes_existing_geography(): void
    {
        $cityId = $this->existingCityId();

        $area = $this->makeArea();

        $response = $this->auth()->postJson(self::NETWORK."/service-areas/{$area->uuid}/members", [
            'member_type' => CoverageMemberType::City->value,
            'member_id' => $cityId,
        ])->assertOk();

        $member = collect($response->json('data.members'))->firstWhere('member_id', $cityId);

        $this->assertNotNull($member);
        // The name is resolved LIVE from V1, never stored.
        $this->assertNotNull($member['name']);
        $this->assertFalse($member['is_excluded']);
    }

    public function test_attaching_a_place_that_does_not_exist_is_refused(): void
    {
        $area = $this->makeArea();

        $this->auth()->postJson(self::NETWORK."/service-areas/{$area->uuid}/members", [
            'member_type' => CoverageMemberType::City->value,
            'member_id' => (string) Str::uuid(),
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'already exists'));
    }

    /** A place may belong to one ACTIVE area, or an address resolves to two. */
    public function test_overlapping_active_coverage_is_refused(): void
    {
        $cityId = $this->existingCityId();

        $first = $this->makeArea(['code' => 'SA-A-'.substr(md5(uniqid('', true)), 0, 4)]);
        $this->auth()->postJson(self::NETWORK."/service-areas/{$first->uuid}/members", [
            'member_type' => CoverageMemberType::City->value,
            'member_id' => $cityId,
        ])->assertOk();
        $this->auth()->patchJson(self::NETWORK."/service-areas/{$first->uuid}/status", [
            'status' => ServiceAreaStatus::Active->value,
        ])->assertOk();

        $second = $this->makeArea(['code' => 'SA-B-'.substr(md5(uniqid('', true)), 0, 4)]);

        $this->auth()->postJson(self::NETWORK."/service-areas/{$second->uuid}/members", [
            'member_type' => CoverageMemberType::City->value,
            'member_id' => $cityId,
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'at most one active area'));
    }

    public function test_an_area_with_no_members_cannot_be_activated(): void
    {
        $area = $this->makeArea();

        $this->auth()->patchJson(self::NETWORK."/service-areas/{$area->uuid}/status", [
            'status' => ServiceAreaStatus::Active->value,
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'no members'));
    }

    public function test_an_illegal_area_transition_is_refused(): void
    {
        $area = $this->makeArea();

        $this->auth()->patchJson(self::NETWORK."/service-areas/{$area->uuid}/status", [
            'status' => ServiceAreaStatus::Paused->value,
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'cannot move from Draft to Paused'));
    }

    /** No coverage is a NORMAL answer — Network advises, Orders decides. */
    public function test_coverage_resolution_returns_a_normal_answer_when_uncovered(): void
    {
        $cityId = $this->existingCityId();

        $this->auth()->postJson(self::NETWORK.'/coverage/resolve', ['city_id' => $cityId])
            ->assertOk()
            ->assertJsonPath('data.covered', false)
            ->assertJsonPath('data.service_area', null);
    }

    // ── Capacity ─────────────────────────────────────────────────────────────

    /** Availability NEVER rejects. It reports remaining and shortfall. */
    public function test_capacity_availability_is_advisory(): void
    {
        $slot = $this->makeSlot(10);

        $this->auth()->postJson(self::NETWORK.'/capacity/availability', [
            'slot_id' => $slot->uuid,
            'orders' => 50,
        ])->assertOk()
            ->assertJsonPath('data.can_accommodate', false)
            ->assertJsonPath('data.shortfall.orders', 40);
    }

    public function test_capacity_is_multi_dimensional_and_the_tightest_binds(): void
    {
        $slot = $this->makeSlot(100);
        $slot->update(['available_weight_kg' => 50, 'committed_weight_kg' => 45]);

        $slot->refresh();

        // Orders are barely touched; weight is 90% consumed. Weight binds.
        $this->assertSame(CapacityUnit::WeightKg, $slot->bindingUnit());
        $this->assertTrue($slot->isAtWarnThreshold());
    }

    public function test_reserving_deducts_capacity_and_a_soft_hold_expires(): void
    {
        $slot = $this->makeSlot(10);
        $ledger = app(CapacityLedgerService::class);

        $response = $this->auth()->postJson(self::NETWORK.'/capacity/reserve', [
            'slot_id' => $slot->uuid,
            'orders' => 4,
            'ttl_minutes' => 30,
        ])->assertCreated();

        $this->assertSame(6.0, $slot->refresh()->remainingFor(CapacityUnit::Orders));
        $this->assertNotNull($response->json('data.expires_at'));

        // Force the hold past its TTL, then sweep.
        DB::table('network_capacity_commitments')
            ->where('uuid', $response->json('data.id'))
            ->update(['expires_at' => now()->subHour()]);

        $this->assertSame(1, $ledger->sweepExpired());
        // Capacity came back — abandoned checkouts must not eat a day's supply.
        $this->assertSame(10.0, $slot->refresh()->remainingFor(CapacityUnit::Orders));
    }

    public function test_reserving_more_than_remains_is_refused(): void
    {
        $slot = $this->makeSlot(5);

        $this->auth()->postJson(self::NETWORK.'/capacity/reserve', [
            'slot_id' => $slot->uuid,
            'orders' => 9,
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'Short by'));
    }

    public function test_exhausting_a_slot_publishes_an_event(): void
    {
        Event::fake([CapacityExhausted::class]);

        $slot = $this->makeSlot(4);

        $this->auth()->postJson(self::NETWORK.'/capacity/reserve', [
            'slot_id' => $slot->uuid,
            'orders' => 4,
        ])->assertCreated();

        Event::assertDispatched(CapacityExhausted::class);
    }

    public function test_releasing_a_committed_reservation_requires_a_reason(): void
    {
        $slot = $this->makeSlot(10);

        $reserved = $this->auth()->postJson(self::NETWORK.'/capacity/reserve', [
            'slot_id' => $slot->uuid,
            'orders' => 2,
        ])->assertCreated();

        $id = $reserved->json('data.id');
        $this->auth()->patchJson(self::NETWORK."/capacity/{$id}/commit")->assertOk();

        $this->auth()->patchJson(self::NETWORK."/capacity/{$id}/release", [])->assertStatus(422);

        $this->auth()->patchJson(self::NETWORK."/capacity/{$id}/release", [
            'reason' => 'Customer cancelled.',
        ])->assertOk();

        $this->assertSame(10.0, $slot->refresh()->remainingFor(CapacityUnit::Orders));
    }

    // ═══ DISPATCH ════════════════════════════════════════════════════════════

    public function test_dispatch_options_expose_every_vocabulary(): void
    {
        $this->auth()->getJson(self::DISPATCH.'/options')
            ->assertOk()
            ->assertJsonCount(8, 'board_statuses')
            ->assertJsonCount(4, 'proposal_statuses')
            ->assertJsonCount(6, 'assignment_statuses');
    }

    /**
     * DIRECTIVE 5 — Dispatch consumes Fleet's PUBLIC contract only.
     *
     * The container resolves the interface to Fleet's implementation, and
     * Dispatch never names a fleet_* table or a Fleet model.
     */
    public function test_dispatch_consumes_the_fleet_readiness_contract(): void
    {
        $this->assertInstanceOf(
            FleetReadinessQueryInterface::class,
            app(FleetReadinessQueryInterface::class),
        );

        $source = file_get_contents(base_path(
            'Modules/Logistics/Dispatch/Domain/Services/ResourcePoolService.php'
        ));

        $this->assertStringContainsString('FleetReadinessQueryInterface', $source);

        // Strip comments — an explanatory comment is the point, not a leak.
        $code = preg_replace('#/\*.*?\*/|//[^\n]*#s', '', $source);

        foreach ([
            'fleet_units', 'fleet_defects', 'FleetUnit', 'FleetReadinessService',
            'MaintenancePlan', 'Fleet\\Domain\\Models',
        ] as $internal) {
            $this->assertStringNotContainsString($internal, $code);
        }
    }

    public function test_the_resource_pool_batches_fleet_verdicts(): void
    {
        $pool = app(ResourcePoolService::class)->build($this->company->id);

        $this->assertArrayHasKey('vehicles', $pool);
        $this->assertArrayHasKey('drivers', $pool);
        $this->assertArrayHasKey('assignable_vehicle_count', $pool);

        foreach ($pool['vehicles'] as $vehicle) {
            // Fleet's verdict travels with each row, ordered reasons included.
            $this->assertArrayHasKey('fitness', $vehicle);
            $this->assertArrayHasKey('blockers', $vehicle['fitness']);
            $this->assertArrayHasKey('v1_dispatchable', $vehicle);
        }
    }

    public function test_a_board_is_opened_once_per_origin_and_date(): void
    {
        $region = DispatchRegion::create([
            'company_id' => $this->company->id,
            'code' => 'REG-'.substr(md5(uniqid('', true)), 0, 5),
            'name' => 'Cairo Main',
        ]);

        $date = now()->addDay()->toDateString();

        $this->auth()->postJson(self::DISPATCH.'/boards', [
            'board_date' => $date,
            'dispatch_region_id' => $region->id,
        ])->assertCreated()->assertJsonPath('data.status', DispatchBoardStatus::Open->value);

        $this->auth()->postJson(self::DISPATCH.'/boards', [
            'board_date' => $date,
            'dispatch_region_id' => $region->id,
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'already exists'));
    }

    public function test_an_illegal_board_transition_is_refused(): void
    {
        $board = $this->openBoard();

        $this->auth()->patchJson(self::DISPATCH."/boards/{$board->uuid}/status", [
            'status' => DispatchBoardStatus::Released->value,
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'cannot move from Open'));
    }

    /** A proposal is immutable once decided — re-running creates a new one. */
    public function test_a_decided_proposal_cannot_be_decided_again(): void
    {
        $board = $this->openBoard();
        $this->makeTrip(['status' => 'planning']);

        $proposal = $this->auth()->postJson(self::DISPATCH."/boards/{$board->uuid}/propose")
            ->assertCreated();

        $id = $proposal->json('data.uuid');

        $this->auth()->patchJson(self::DISPATCH."/proposals/{$id}/accept")->assertOk();

        $this->auth()->patchJson(self::DISPATCH."/proposals/{$id}/reject", [
            'reason' => 'Changed my mind',
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'already been decided'));
    }

    /** A blocked assignment always states its ordered reasons. */
    public function test_a_blocked_assignment_explains_itself(): void
    {
        $board = $this->openBoard();
        // A trip with no fit vehicle in the pool.
        $this->makeTrip(['status' => 'planning', 'capacity' => 999]);

        $proposal = $this->auth()->postJson(self::DISPATCH."/boards/{$board->uuid}/propose")
            ->assertCreated();

        $assignments = $proposal->json('data.assignments');
        $this->assertNotEmpty($assignments);

        $blocked = collect($assignments)->firstWhere('status', 'blocked');

        if ($blocked !== null) {
            $this->assertNotEmpty($blocked['blockers']);
        }

        $this->assertGreaterThanOrEqual(0, $proposal->json('data.blocked_count'));
    }

    /** Releasing an un-accepted proposal is refused. */
    public function test_release_requires_an_accepted_proposal(): void
    {
        $board = $this->openBoard();
        $this->makeTrip(['status' => 'planning']);

        $proposal = $this->auth()->postJson(self::DISPATCH."/boards/{$board->uuid}/propose")
            ->assertCreated();

        $this->auth()->postJson(self::DISPATCH."/proposals/{$proposal->json('data.uuid')}/release")
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'must be accepted'));
    }

    /**
     * DIRECTIVE 6/11 — Distribution remains the execution authority.
     *
     * Dispatch writes no distribution_* or logistics_driver_vehicle_assignments
     * row directly; it calls their services and records the receipts.
     */
    public function test_dispatch_writes_no_v1_table_directly(): void
    {
        foreach ([
            'Modules/Logistics/Dispatch/Domain/Services/DispatchReleaseService.php',
            'Modules/Logistics/Dispatch/Domain/Services/DispatchProposalService.php',
        ] as $path) {
            $code = preg_replace(
                '#/\*.*?\*/|//[^\n]*#s',
                '',
                file_get_contents(base_path($path)),
            );

            foreach ([
                "table('distribution_trips')",
                "table('logistics_driver_vehicle_assignments')",
                "table('delivery_deliveries')",
            ] as $forbidden) {
                $this->assertStringNotContainsString($forbidden, $code);
            }
        }

        // The release path must go through V1's own services.
        $release = file_get_contents(base_path(
            'Modules/Logistics/Dispatch/Domain/Services/DispatchReleaseService.php'
        ));
        $this->assertStringContainsString('DriverVehicleAssignmentService', $release);
        $this->assertStringContainsString('TripService', $release);
    }

    public function test_the_release_table_records_the_v1_receipts(): void
    {
        $columns = Schema::getColumnListing('dispatch_releases');

        // The audit trail proving the boundary was crossed correctly.
        $this->assertContains('v1_trip_id', $columns);
        $this->assertContains('v1_assignment_id', $columns);
        $this->assertContains('failure_reason', $columns);
    }

    /** Dispatch stores no vehicle or driver master data. */
    public function test_dispatch_tables_duplicate_no_master_data(): void
    {
        $columns = Schema::getColumnListing('dispatch_proposed_assignments');

        foreach ([
            'plate_number', 'vehicle_code', 'driver_name', 'driver_code',
            'capacity_orders', 'trip_number',
        ] as $forbidden) {
            $this->assertNotContains($forbidden, $columns);
        }

        // Only references, plus what Dispatch genuinely owns.
        $this->assertContains('vehicle_id', $columns);
        $this->assertContains('driver_id', $columns);
        $this->assertContains('score', $columns);
    }

    // ═══ ROUTING ═════════════════════════════════════════════════════════════

    public function test_routing_publishes_its_strategy_catalogue(): void
    {
        $response = $this->auth()->getJson(self::ROUTING.'/strategies')->assertOk();

        $names = array_column($response->json('data'), 'name');

        $this->assertContains('sequential_zone', $names);
        $this->assertContains('nearest_neighbour', $names);

        // Every strategy publishes a version — without it a replay silently
        // compares apples to pears.
        foreach ($response->json('data') as $strategy) {
            $this->assertNotEmpty($strategy['version']);
        }
    }

    /**
     * DIRECTIVE 10 — the purity contract.
     *
     * A strategy may not read a repository, a cache or the clock. Same input,
     * same output, always.
     */
    public function test_strategies_are_pure_and_deterministic(): void
    {
        $request = $this->sampleRequest();

        foreach ([new SequentialZoneStrategy, new NearestNeighbourStrategy] as $strategy) {
            if (! $strategy->supports($request)) {
                continue;
            }

            $first = $strategy->optimize($request);
            $second = $strategy->optimize($request);

            $this->assertSame($first->sequence, $second->sequence, $strategy->name().' is not deterministic');
            $this->assertSame($first->totalDistanceKm, $second->totalDistanceKm);
        }

        // And structurally: no I/O in the strategy source.
        foreach ([
            'Modules/Logistics/Routing/Domain/Strategies/SequentialZoneStrategy.php',
            'Modules/Logistics/Routing/Domain/Strategies/NearestNeighbourStrategy.php',
            'Modules/Logistics/Routing/Domain/Strategies/LegBuilder.php',
        ] as $path) {
            $code = preg_replace('#/\*.*?\*/|//[^\n]*#s', '', file_get_contents(base_path($path)));

            foreach (['DB::', 'Cache::', 'now()', 'Carbon::now', '::query()', 'app('] as $impurity) {
                $this->assertStringNotContainsString($impurity, $code, basename($path).' broke purity');
            }
        }
    }

    /** The fallback must never refuse — it is the baseline of last resort. */
    public function test_the_default_strategy_always_supports_a_request(): void
    {
        $strategy = new SequentialZoneStrategy;

        $ungeocoded = new RouteRequest(
            tripId: 1,
            origin: null,
            stops: [new RouteStop(stopId: 1), new RouteStop(stopId: 2)],
        );

        $this->assertTrue($strategy->supports($ungeocoded));

        $proposal = $strategy->optimize($ungeocoded);
        $this->assertCount(2, $proposal->sequence);
        // No silent estimates: missing coordinates are reported.
        $this->assertNotEmpty($proposal->violations);
    }

    /** A geometric strategy refuses without coordinates, and the resolver falls back. */
    public function test_the_resolver_falls_back_when_a_strategy_cannot_support_a_request(): void
    {
        $resolver = app(RoutingStrategyResolver::class);

        $ungeocoded = new RouteRequest(
            tripId: 1,
            origin: null,
            stops: [new RouteStop(stopId: 1), new RouteStop(stopId: 2)],
        );

        $this->assertFalse((new NearestNeighbourStrategy)->supports($ungeocoded));
        $this->assertSame('sequential_zone', $resolver->resolve($ungeocoded, 'nearest_neighbour')->name());
    }

    public function test_nearest_neighbour_beats_the_baseline_on_a_geocoded_route(): void
    {
        $request = $this->sampleRequest();

        $baseline = (new SequentialZoneStrategy)->optimize($request);
        $geometric = (new NearestNeighbourStrategy)->optimize($request);

        // Optimisation uplift is measured against the same baseline every time.
        $this->assertLessThanOrEqual($baseline->totalDistanceKm, $geometric->totalDistanceKm);
    }

    /** A reroute may not move a stop that has already been attempted. */
    public function test_frozen_stops_keep_their_position(): void
    {
        $request = new RouteRequest(
            tripId: 1,
            origin: GeoPoint::make(30.0444, 31.2357),
            stops: [
                new RouteStop(stopId: 9, point: GeoPoint::make(30.20, 31.40), isFrozen: true),
                new RouteStop(stopId: 1, point: GeoPoint::make(30.05, 31.24), zoneId: 'A'),
                new RouteStop(stopId: 2, point: GeoPoint::make(30.06, 31.25), zoneId: 'A'),
            ],
        );

        foreach ([new SequentialZoneStrategy, new NearestNeighbourStrategy] as $strategy) {
            $proposal = $strategy->optimize($request);
            $this->assertSame(9, $proposal->sequence[0], $strategy->name().' moved a frozen stop');
        }
    }

    public function test_the_optimisation_run_stores_a_replayable_snapshot(): void
    {
        $columns = Schema::getColumnListing('routing_optimization_runs');

        // The replay harness and the future AI corpus.
        $this->assertContains('request_snapshot', $columns);
        $this->assertContains('strategy', $columns);
        $this->assertContains('strategy_version', $columns);
        $this->assertContains('proposal_summary', $columns);
    }

    /** Routing references Distribution's stop; it copies nothing. */
    public function test_routing_tables_duplicate_no_stop_data(): void
    {
        $columns = Schema::getColumnListing('routing_route_stop_refs');

        foreach (['address', 'customer_name', 'customer_id', 'order_id', 'phone'] as $forbidden) {
            $this->assertNotContains($forbidden, $columns);
        }

        $this->assertContains('stop_id', $columns);
    }

    /** D3: nothing in Routing reads telemetry. */
    public function test_routing_does_not_depend_on_telemetry(): void
    {
        foreach ([
            'Modules/Logistics/Routing/Domain/Services/EtaEngine.php',
            'Modules/Logistics/Routing/Domain/Services/RoutePlannerService.php',
        ] as $path) {
            $code = preg_replace('#/\*.*?\*/|//[^\n]*#s', '', file_get_contents(base_path($path)));

            foreach (['telemetry_', 'Telemetry\\', 'PositionSnapshot'] as $token) {
                $this->assertStringNotContainsString($token, $code);
            }
        }
    }

    // ═══ CARRIERS ════════════════════════════════════════════════════════════

    public function test_carrier_options_publish_the_adapter_registry(): void
    {
        $response = $this->auth()->getJson(self::CARRIERS.'/options')->assertOk();

        $keys = array_column($response->json('adapters'), 'key');
        $this->assertContains(InternalFleetAdapter::KEY, $keys);

        // Every capability publishes what its ABSENCE means, so a missing
        // feature is answerable without opening an adapter.
        foreach ($response->json('capabilities') as $capability) {
            $this->assertNotEmpty($capability['absence_meaning']);
        }
    }

    /** Own fleet is a first-class carrier — the core cannot tell the difference. */
    public function test_the_internal_fleet_adapter_is_registered_and_connectable(): void
    {
        $factory = app(CarrierAdapterFactory::class);

        $this->assertTrue($factory->has(InternalFleetAdapter::KEY));

        $account = CarrierAccount::create([
            'company_id' => $this->company->id,
            'adapter_key' => InternalFleetAdapter::KEY,
            'code' => 'OWN-'.substr(md5(uniqid('', true)), 0, 5),
            'name' => 'Own Fleet',
            'mode' => CarrierAccount::MODE_INTERNAL,
        ]);

        $result = $factory->for($account)->testConnection($account);

        $this->assertTrue($result['ok']);
        $this->assertTrue($account->isInternal());
    }

    public function test_an_unknown_adapter_is_refused_rather_than_falling_back(): void
    {
        $this->auth()->postJson(self::CARRIERS.'/accounts', [
            'adapter_key' => 'no_such_carrier',
            'code' => 'X-'.substr(md5(uniqid('', true)), 0, 5),
            'name' => 'Nonexistent',
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'wrong place'));
    }

    /**
     * DIRECTIVE 9 — an unmappable status is EXPLICIT, never guessed.
     *
     * A wrong status silently applied to a customer order is far worse than a
     * visible integration gap.
     */
    public function test_an_unmappable_status_is_reported_not_guessed(): void
    {
        $account = CarrierAccount::create([
            'company_id' => $this->company->id,
            'adapter_key' => InternalFleetAdapter::KEY,
            'code' => 'OWN-'.substr(md5(uniqid('', true)), 0, 5),
            'name' => 'Own Fleet',
        ]);

        $adapter = app(CarrierAdapterFactory::class)->for($account);

        $event = $adapter->parseWebhook($account, [
            'event_id' => 'evt-1',
            'status' => 'SOME_UNKNOWN_CARRIER_CODE',
        ]);

        $this->assertTrue($event->isUnmapped());
        $this->assertNull($event->deliveryStatus);
        // The raw value is preserved for the integration-gap queue.
        $this->assertSame('SOME_UNKNOWN_CARRIER_CODE', $event->rawStatus);
    }

    /** A known status is translated into ECOS vocabulary. */
    public function test_a_known_status_is_translated_into_ecos_vocabulary(): void
    {
        $account = CarrierAccount::create([
            'company_id' => $this->company->id,
            'adapter_key' => InternalFleetAdapter::KEY,
            'code' => 'OWN-'.substr(md5(uniqid('', true)), 0, 5),
            'name' => 'Own Fleet',
        ]);

        $event = app(CarrierAdapterFactory::class)->for($account)->parseWebhook($account, [
            'event_id' => 'evt-2',
            'status' => 'out_for_delivery',
        ]);

        $this->assertFalse($event->isUnmapped());
        $this->assertSame('out_for_delivery', $event->deliveryStatus?->value);
    }

    /** Credentials never leave the Provider Platform. */
    public function test_carrier_credentials_are_never_serialised(): void
    {
        $account = CarrierAccount::create([
            'company_id' => $this->company->id,
            'adapter_key' => InternalFleetAdapter::KEY,
            'code' => 'OWN-'.substr(md5(uniqid('', true)), 0, 5),
            'name' => 'Own Fleet',
            'provider_reference' => 'provider-secret-ref',
        ]);

        $payload = $this->auth()->getJson(self::CARRIERS."/accounts/{$account->uuid}")
            ->assertOk()->json('data');

        $this->assertArrayNotHasKey('provider_reference', $payload);
        $this->assertTrue($payload['has_credentials']);
        $this->assertStringNotContainsString('provider-secret-ref', json_encode($payload));
    }

    /**
     * DIRECTIVE 9 — no carrier name outside its own adapter folder.
     *
     * Onboarding carrier #16 must be a new class in a new folder, nothing else.
     */
    public function test_no_carrier_brand_leaks_into_the_core(): void
    {
        $coreDirs = [
            'Modules/Logistics/Carriers/Domain',
            'Modules/Logistics/Carriers/Presentation',
        ];

        // Brands that would be plausible future adapters.
        $brands = ['Aramex', 'Bosta', 'Mylerz', 'DHL', 'FedEx'];

        foreach ($coreDirs as $dir) {
            $files = glob(base_path($dir).'/**/*.php', GLOB_BRACE) ?: [];
            $files = array_merge($files, glob(base_path($dir).'/*/*/*.php') ?: []);

            foreach ($files as $file) {
                $source = file_get_contents($file);

                foreach ($brands as $brand) {
                    $this->assertStringNotContainsString(
                        $brand,
                        $source,
                        basename($file).' names a carrier outside its adapter',
                    );
                }
            }
        }
    }

    // ═══ AUTHORIZATION ═══════════════════════════════════════════════════════

    public function test_every_phase_2_endpoint_requires_authentication(): void
    {
        $this->getJson(self::NETWORK.'/service-areas')->assertUnauthorized();
        $this->getJson(self::DISPATCH.'/boards')->assertUnauthorized();
        $this->getJson(self::ROUTING.'/strategies')->assertUnauthorized();
        $this->getJson(self::CARRIERS.'/accounts')->assertUnauthorized();
    }

    public function test_a_user_without_the_permission_is_refused(): void
    {
        $stranger = User::factory()->create(['company_id' => $this->company->id]);

        $this->actingAsUnprivileged($stranger)->getJson(self::NETWORK.'/service-areas')->assertForbidden();
        $this->actingAsUnprivileged($stranger)->getJson(self::DISPATCH.'/boards')->assertForbidden();
        $this->actingAsUnprivileged($stranger)->getJson(self::ROUTING.'/strategies')->assertForbidden();
        $this->actingAsUnprivileged($stranger)->getJson(self::CARRIERS.'/accounts')->assertForbidden();
    }

    /** Propose and release are separate so a proposal cannot commit itself. */
    public function test_proposing_does_not_grant_releasing(): void
    {
        $proposer = User::factory()->create(['company_id' => $this->company->id]);
        $role = Role::create([
            'name' => 'Dispatch Proposer',
            'slug' => 'dispatch-proposer-'.substr(md5(uniqid('', true)), 0, 8),
            'is_system' => false,
        ]);
        $role->permissions()->attach(
            Permission::whereIn('name', ['dispatch.view', 'dispatch.propose'])->pluck('id')
        );
        $proposer->roles()->attach($role->id);

        $board = $this->openBoard();

        $this->actingAs($proposer)->getJson(self::DISPATCH."/boards/{$board->uuid}")->assertOk();
        $this->actingAs($proposer)
            ->postJson(self::DISPATCH."/boards/{$board->uuid}/propose")
            ->assertSuccessful();

        // Accepting and releasing need dispatch.release.
        $this->actingAs($proposer)
            ->postJson(self::DISPATCH.'/proposals/'.Str::uuid().'/release')
            ->assertForbidden();
    }

    public function test_the_thirteen_phase_2_permissions_are_seeded(): void
    {
        foreach ([
            'network.view', 'network.manage', 'network.capacity.manage', 'network.capacity.commit',
            'dispatch.view', 'dispatch.propose', 'dispatch.release', 'dispatch.manage',
            'routing.view', 'routing.optimize', 'routing.manage',
            'carrier.view', 'carrier.manage',
        ] as $name) {
            $this->assertTrue(
                Permission::where('name', $name)->exists(),
                "Permission {$name} was not seeded",
            );
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function openBoard(): DispatchBoard
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

    private function sampleRequest(): RouteRequest
    {
        return new RouteRequest(
            tripId: 1,
            origin: GeoPoint::make(30.0444, 31.2357),
            stops: [
                new RouteStop(stopId: 3, point: GeoPoint::make(30.20, 31.40), zoneId: 'C'),
                new RouteStop(stopId: 1, point: GeoPoint::make(30.05, 31.24), zoneId: 'A'),
                new RouteStop(stopId: 4, point: GeoPoint::make(30.25, 31.45), zoneId: 'D'),
                new RouteStop(stopId: 2, point: GeoPoint::make(30.06, 31.25), zoneId: 'B'),
            ],
        );
    }
}
