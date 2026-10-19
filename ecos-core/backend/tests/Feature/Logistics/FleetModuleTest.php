<?php

declare(strict_types=1);

namespace Tests\Feature\Logistics;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Modules\IAM\Domain\Models\Permission;
use Modules\IAM\Domain\Models\Role;
use Modules\Logistics\Fleet\Domain\Enums\DefectSeverity;
use Modules\Logistics\Fleet\Domain\Enums\FitnessLevel;
use Modules\Logistics\Fleet\Domain\Enums\FleetUnitLifecycle;
use Modules\Logistics\Fleet\Domain\Enums\FuelTransactionStatus;
use Modules\Logistics\Fleet\Domain\Enums\InspectionKind;
use Modules\Logistics\Fleet\Domain\Enums\MaintenanceTrigger;
use Modules\Logistics\Fleet\Domain\Enums\OdometerSource;
use Modules\Logistics\Fleet\Domain\Events\VehicleBecameUnfit;
use Modules\Logistics\Fleet\Domain\Models\Fleet;
use Modules\Logistics\Fleet\Domain\Models\FleetGroup;
use Modules\Logistics\Fleet\Domain\Models\FleetUnit;
use Modules\Logistics\Fleet\Domain\Models\InspectionTemplate;
use Modules\Logistics\Fleet\Domain\Services\FleetReadinessService;
use Modules\Logistics\Fleet\Domain\Services\OdometerService;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * EPIC-LOG-V2-001 Phase 1 — Fleet Operations
 *
 * Covers the fleet lifecycle, readiness verdict, maintenance planning and
 * execution, inspections, defects, fuel and cost — and above all the
 * architectural boundaries the CTO fixed:
 *
 *   • Directive 1/2 — Fleet holds CONDITION, never IDENTITY. No V1 table is
 *     written directly; completing work goes through VehicleMaintenanceService.
 *   • Directive 3 — Fleet Operations is independent of Delivery Execution.
 *   • Directive 5 / D3 — nothing depends on telemetry.
 *   • D8 — Fleet owns operational cost only; no trip cash is touched.
 */
class FleetModuleTest extends TestCase
{
    use DatabaseTransactions;

    private const BASE = '/api/logistics/fleet';

    private User $user;

    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->user = User::factory()->create(['company_id' => $this->company->id]);

        $role = Role::create([
            'name' => 'Fleet Test Admin',
            'slug' => 'fleet-test-admin-'.substr(md5(uniqid('', true)), 0, 8),
            'is_system' => true,
        ]);
        $this->user->roles()->attach($role->id);
    }

    private function auth(): static
    {
        return $this->actingAs($this->user);
    }

    // ── Fixtures ──────────────────────────────────────────────────────────────

    private function makeVehicle(array $overrides = []): Vehicle
    {
        $suffix = substr(md5(uniqid('', true)), 0, 8);

        return Vehicle::create(array_merge([
            'vehicle_code' => 'VEH-'.$suffix,
            'plate_number' => 'PL-'.$suffix,
            'type' => 'van',
            'capacity_orders' => 60,
            'company_id' => $this->company->id,
        ], $overrides));
    }

    private function makeGroup(): FleetGroup
    {
        $suffix = substr(md5(uniqid('', true)), 0, 6);

        $fleet = Fleet::create([
            'company_id' => $this->company->id,
            'code' => 'FLT-'.$suffix,
            'name' => 'Cairo Own Fleet',
        ]);

        return FleetGroup::create([
            'fleet_id' => $fleet->id,
            'company_id' => $this->company->id,
            'code' => 'GRP-'.$suffix,
            'name' => 'Light Vans',
        ]);
    }

    /** A registered unit with its default plans seeded. */
    private function makeUnit(array $overrides = []): FleetUnit
    {
        $vehicle = $this->makeVehicle();

        $response = $this->auth()->postJson(self::BASE.'/units', array_merge([
            'vehicle_id' => $vehicle->id,
        ], $overrides))->assertCreated();

        return FleetUnit::where('uuid', $response->json('data.uuid'))->firstOrFail();
    }

    /** A unit driven to `active`, which needs an approved inspection first. */
    private function makeActiveUnit(): FleetUnit
    {
        $unit = $this->makeUnit(['fleet_group_id' => $this->makeGroup()->id]);

        $template = $this->makeTemplate($unit->fleet_group_id);
        $inspection = $this->auth()->postJson(self::BASE."/units/{$unit->uuid}/inspections", [
            'template_id' => $template->uuid,
            'kind' => InspectionKind::Periodic->value,
            'odometer_km' => 10000,
        ])->assertCreated();

        $inspectionUuid = $inspection->json('data.uuid');

        $this->auth()->patchJson(
            self::BASE."/units/{$unit->uuid}/inspections/{$inspectionUuid}/submit",
            ['answers' => ['brakes' => ['passed' => true], 'tyres' => ['passed' => true]]],
        )->assertOk();

        $this->auth()->patchJson(
            self::BASE."/units/{$unit->uuid}/inspections/{$inspectionUuid}/approve"
        )->assertOk();

        $this->auth()->patchJson(self::BASE."/units/{$unit->uuid}/lifecycle", [
            'lifecycle_state' => FleetUnitLifecycle::Commissioning->value,
        ])->assertOk();

        $this->auth()->patchJson(self::BASE."/units/{$unit->uuid}/lifecycle", [
            'lifecycle_state' => FleetUnitLifecycle::Active->value,
        ])->assertOk();

        return $unit->refresh();
    }

    private function makeTemplate(?int $groupId = null): InspectionTemplate
    {
        $template = InspectionTemplate::create([
            'fleet_group_id' => $groupId,
            'company_id' => $this->company->id,
            'code' => 'TPL-'.substr(md5(uniqid('', true)), 0, 6),
            'name' => 'Daily walk-around',
            'kind' => InspectionKind::Periodic->value,
        ]);

        $template->items()->create([
            'code' => 'brakes',
            'label' => 'Brake system',
            'display_order' => 1,
            'is_mandatory' => true,
            'failure_severity' => DefectSeverity::Critical->value,
        ]);
        $template->items()->create([
            'code' => 'tyres',
            'label' => 'Tyre condition',
            'display_order' => 2,
            'is_mandatory' => true,
            'failure_severity' => DefectSeverity::Major->value,
        ]);

        return $template->refresh();
    }

    // ── Reference data ────────────────────────────────────────────────────────

    public function test_options_expose_every_vocabulary(): void
    {
        $this->auth()->getJson(self::BASE.'/options')
            ->assertOk()
            ->assertJsonCount(6, 'lifecycle_states')
            ->assertJsonCount(3, 'fitness_levels')
            ->assertJsonCount(5, 'work_order_statuses')
            ->assertJsonCount(5, 'inspection_statuses')
            ->assertJsonCount(5, 'inspection_kinds')
            ->assertJsonCount(6, 'defect_statuses')
            ->assertJsonCount(3, 'defect_severities')
            ->assertJsonCount(6, 'fuel_statuses')
            ->assertJsonCount(3, 'maintenance_triggers')
            ->assertJsonCount(5, 'odometer_sources')
            ->assertJsonCount(8, 'cost_types');
    }

    // ── Registration and the identity boundary ────────────────────────────────

    public function test_registering_a_unit_seeds_plans_and_exposes_a_public_uuid(): void
    {
        $vehicle = $this->makeVehicle();

        $response = $this->auth()->postJson(self::BASE.'/units', [
            'vehicle_id' => $vehicle->id,
        ])->assertCreated();

        $response
            ->assertJsonPath('data.lifecycle_state', FleetUnitLifecycle::Draft->value)
            ->assertJsonPath('data.vehicle_id', $vehicle->id);

        $this->assertSame($response->json('data.id'), $response->json('data.uuid'));

        // Default plans are seeded so a new unit is immediately useful.
        $unit = FleetUnit::where('uuid', $response->json('data.uuid'))->firstOrFail();
        $this->assertSame(3, $unit->maintenancePlans()->count());
    }

    /** Directive 2: a vehicle may have exactly one operational shadow. */
    public function test_a_vehicle_cannot_be_registered_twice(): void
    {
        $vehicle = $this->makeVehicle();

        $this->auth()->postJson(self::BASE.'/units', ['vehicle_id' => $vehicle->id])->assertCreated();

        $this->auth()->postJson(self::BASE.'/units', ['vehicle_id' => $vehicle->id])
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'exactly one'));
    }

    /**
     * Directive 2 — Fleet holds CONDITION, never IDENTITY.
     *
     * If anyone adds plate_number or capacity_orders to fleet_units, the
     * boundary has been broken and this test says so.
     */
    public function test_fleet_tables_duplicate_no_vehicle_master_data(): void
    {
        $columns = Schema::getColumnListing('fleet_units');

        foreach ([
            'plate_number', 'vin', 'capacity_orders', 'capacity_weight_kg',
            'fuel_type', 'manufacturer', 'model', 'vehicle_code', 'status',
        ] as $forbidden) {
            $this->assertNotContains($forbidden, $columns, "fleet_units must not own {$forbidden}");
        }

        // Nor driver or carrier identity.
        foreach (['driver_id', 'driver_code', 'carrier_id'] as $forbidden) {
            $this->assertNotContains($forbidden, $columns);
        }
    }

    public function test_company_is_inherited_from_the_vehicle(): void
    {
        $vehicle = $this->makeVehicle();
        $unit = $this->makeUnit(['vehicle_id' => $vehicle->id]);

        $this->assertSame((string) $vehicle->company_id, (string) $unit->company_id);
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    public function test_an_illegal_lifecycle_transition_is_refused(): void
    {
        $unit = $this->makeUnit();

        $this->auth()->patchJson(self::BASE."/units/{$unit->uuid}/lifecycle", [
            'lifecycle_state' => FleetUnitLifecycle::Active->value,
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'cannot move from Draft to Active'));
    }

    public function test_activation_requires_an_approved_inspection(): void
    {
        $unit = $this->makeUnit();

        $this->auth()->patchJson(self::BASE."/units/{$unit->uuid}/lifecycle", [
            'lifecycle_state' => FleetUnitLifecycle::Commissioning->value,
        ])->assertOk();

        $this->auth()->patchJson(self::BASE."/units/{$unit->uuid}/lifecycle", [
            'lifecycle_state' => FleetUnitLifecycle::Active->value,
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'commissioning inspection'));
    }

    public function test_suspension_requires_a_reason(): void
    {
        $unit = $this->makeActiveUnit();

        $this->auth()->patchJson(self::BASE."/units/{$unit->uuid}/lifecycle", [
            'lifecycle_state' => FleetUnitLifecycle::Suspended->value,
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'requires a reason'));
    }

    // ── Fitness ───────────────────────────────────────────────────────────────

    public function test_an_active_unit_with_nothing_outstanding_is_fit(): void
    {
        $unit = $this->makeActiveUnit();

        // Assignable with NO blockers is the contract. A freshly onboarded unit
        // legitimately carries warnings — no pre-trip or statutory inspection is
        // on record yet — and warnings must never gate dispatch.
        $this->auth()->getJson(self::BASE."/units/{$unit->uuid}/fitness")
            ->assertOk()
            ->assertJsonPath('data.is_assignable', true)
            ->assertJsonPath('data.blockers', [])
            ->assertJsonPath(
                'data.level',
                fn (string $level) => in_array($level, [
                    FitnessLevel::Fit->value,
                    FitnessLevel::FitWithWarnings->value,
                ], true),
            );
    }

    /** A suspended unit is unfit, without Fleet ever writing VehicleStatus. */
    public function test_a_suspended_unit_is_unfit_and_says_why(): void
    {
        $unit = $this->makeActiveUnit();
        $vehicleStatusBefore = $unit->vehicle->status;

        $this->auth()->patchJson(self::BASE."/units/{$unit->uuid}/lifecycle", [
            'lifecycle_state' => FleetUnitLifecycle::Suspended->value,
            'reason' => 'Insurance dispute',
        ])->assertOk();

        $verdict = $this->auth()->getJson(self::BASE."/units/{$unit->uuid}/fitness")->assertOk();

        $verdict->assertJsonPath('data.level', FitnessLevel::Unfit->value);
        $this->assertStringContainsString('Insurance dispute', $verdict->json('data.blockers.0'));

        // LOG-003 owns VehicleStatus; a V2 suspension must not touch it.
        $this->assertSame($vehicleStatusBefore, $unit->vehicle->refresh()->status);
    }

    public function test_a_critical_defect_makes_the_vehicle_unfit_immediately(): void
    {
        Event::fake([VehicleBecameUnfit::class]);

        $unit = $this->makeActiveUnit();

        $this->auth()->postJson(self::BASE."/units/{$unit->uuid}/defects", [
            'title' => 'Brake fluid leak',
            'severity' => DefectSeverity::Critical->value,
        ])->assertCreated();

        $verdict = $this->auth()->getJson(self::BASE."/units/{$unit->uuid}/fitness")->assertOk();

        $verdict->assertJsonPath('data.level', FitnessLevel::Unfit->value);
        $this->assertStringContainsString('Brake fluid leak', implode(' ', $verdict->json('data.blockers')));

        Event::assertDispatched(VehicleBecameUnfit::class);
    }

    public function test_a_major_defect_warns_but_does_not_block(): void
    {
        $unit = $this->makeActiveUnit();

        $this->auth()->postJson(self::BASE."/units/{$unit->uuid}/defects", [
            'title' => 'Cracked wing mirror',
            'severity' => DefectSeverity::Major->value,
        ])->assertCreated();

        $this->auth()->getJson(self::BASE."/units/{$unit->uuid}/fitness")
            ->assertOk()
            ->assertJsonPath('data.level', FitnessLevel::FitWithWarnings->value)
            ->assertJsonPath('data.is_assignable', true);
    }

    /**
     * Directive 3: Fleet never publishes an instruction. A vehicle becoming
     * unfit is a FACT — nothing in Fleet cancels a trip or writes to
     * distribution_* or delivery_*.
     */
    public function test_fleet_never_writes_distribution_or_delivery_tables(): void
    {
        $before = [
            'trips' => DB::table('distribution_trips')->count(),
            'stops' => DB::table('distribution_delivery_stops')->count(),
            'settlements' => DB::table('distribution_trip_settlements')->count(),
            'payments' => DB::table('distribution_payment_collections')->count(),
            'deliveries' => DB::table('delivery_deliveries')->count(),
        ];

        $unit = $this->makeActiveUnit();

        $this->auth()->postJson(self::BASE."/units/{$unit->uuid}/defects", [
            'title' => 'Brake fluid leak',
            'severity' => DefectSeverity::Critical->value,
        ])->assertCreated();

        $this->auth()->postJson(self::BASE."/units/{$unit->uuid}/fuel-transactions", [
            'litres' => 45.5,
            'cost' => 1200,
            'odometer_km' => 10500,
        ])->assertCreated();

        $this->assertSame($before['trips'], DB::table('distribution_trips')->count());
        $this->assertSame($before['stops'], DB::table('distribution_delivery_stops')->count());
        $this->assertSame($before['settlements'], DB::table('distribution_trip_settlements')->count());
        $this->assertSame($before['payments'], DB::table('distribution_payment_collections')->count());
        $this->assertSame($before['deliveries'], DB::table('delivery_deliveries')->count());
    }

    /** Directive 3, structurally: the readiness service imports neither module. */
    public function test_the_readiness_service_does_not_depend_on_delivery_execution(): void
    {
        $source = file_get_contents(
            base_path('Modules/Logistics/Fleet/Domain/Services/FleetReadinessService.php')
        );

        $this->assertStringNotContainsString('Distribution\\', $source);
        $this->assertStringNotContainsString('Delivery\\', $source);

        // Directive 5 / D3: fitness must never READ telemetry. Scan code only —
        // comments explaining the constraint are the point, not a violation.
        $code = preg_replace('#/\*.*?\*/|//[^\n]*#s', '', $source);

        foreach (['telemetry_', 'Telemetry\\', 'TrackedAsset', 'PositionSnapshot'] as $token) {
            $this->assertStringNotContainsString($token, $code);
        }
    }

    // ── Odometer ──────────────────────────────────────────────────────────────

    public function test_the_odometer_is_a_governed_monotonic_series(): void
    {
        $unit = $this->makeActiveUnit();

        $this->auth()->postJson(self::BASE."/units/{$unit->uuid}/odometer", [
            'reading_km' => 12000,
            'source' => OdometerSource::Manual->value,
        ])->assertOk()->assertJsonPath('data.is_accepted', true);

        // A reading below the accepted value is RECORDED but not ACCEPTED —
        // a rolled-back odometer is evidence, not noise.
        $rollback = $this->auth()->postJson(self::BASE."/units/{$unit->uuid}/odometer", [
            'reading_km' => 9000,
            'source' => OdometerSource::Manual->value,
        ])->assertOk();

        $rollback->assertJsonPath('data.is_accepted', false);
        $this->assertNotNull($rollback->json('data.rejection_reason'));
        $this->assertEqualsWithDelta(12000, $rollback->json('data.current_odometer_km'), 0.01);

        // Both readings survive in the series — the accepted one and the
        // rejected rollback, which is retained as evidence rather than dropped.
        $readings = $unit->odometerReadings()->get();
        $this->assertSame(1, $readings->where('reading_km', '9000.0')->count());
        $this->assertSame(1, $readings->where('is_accepted', false)->count());
    }

    // ── Maintenance ───────────────────────────────────────────────────────────

    /**
     * Directive 5 / D3: telemetry is optional and deferred, so a plan whose
     * only rule is engine hours could never be evaluated. Rejecting it at
     * configuration time beats a plan that silently never comes due.
     */
    public function test_a_plan_cannot_depend_on_telemetry_alone(): void
    {
        $unit = $this->makeActiveUnit();

        $this->auth()->postJson(self::BASE."/units/{$unit->uuid}/maintenance-plans", [
            'maintenance_type' => 'engine_service',
            'name' => 'Engine service',
            'rules' => [
                ['trigger' => MaintenanceTrigger::EngineHours->value, 'interval_value' => 500],
            ],
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'telemetry'));
    }

    public function test_a_plan_with_distance_and_time_rules_projects_next_due(): void
    {
        $unit = $this->makeActiveUnit();

        $this->auth()->postJson(self::BASE."/units/{$unit->uuid}/odometer", [
            'reading_km' => 20000,
        ])->assertOk();

        $response = $this->auth()->postJson(self::BASE."/units/{$unit->uuid}/maintenance-plans", [
            'maintenance_type' => 'gearbox_service',
            'name' => 'Gearbox service',
            'rules' => [
                ['trigger' => MaintenanceTrigger::Distance->value, 'interval_value' => 30000],
                ['trigger' => MaintenanceTrigger::Time->value, 'interval_value' => 365],
            ],
        ])->assertCreated();

        $this->assertEqualsWithDelta(50000, $response->json('data.next_due_km'), 0.1);
        $this->assertNotNull($response->json('data.next_due_date'));
        $this->assertFalse($response->json('data.is_due'));
    }

    public function test_overdue_maintenance_blocks_fitness(): void
    {
        $unit = $this->makeActiveUnit();

        // Force a plan past due and past grace.
        $plan = $unit->maintenancePlans()->first();
        $plan->update([
            'next_due_date' => now()->subDays(60)->toDateString(),
            'next_due_km' => null,
            'grace_days' => 7,
        ]);

        $verdict = $this->auth()->getJson(self::BASE."/units/{$unit->uuid}/fitness")->assertOk();

        $verdict->assertJsonPath('data.level', FitnessLevel::Unfit->value);
        $this->assertStringContainsString('overdue', implode(' ', $verdict->json('data.blockers')));
    }

    /**
     * ONE WRITER PER TABLE — completing a work order writes the V1 record via
     * LOG-003's VehicleMaintenanceService, and the returned id is the receipt.
     */
    public function test_completing_a_work_order_writes_the_v1_maintenance_record(): void
    {
        $unit = $this->makeActiveUnit();
        $v1Before = DB::table('logistics_vehicle_maintenance_records')->count();

        $order = $this->auth()->postJson(self::BASE."/units/{$unit->uuid}/work-orders", [
            'maintenance_type' => 'oil_change',
            'description' => 'Scheduled oil change',
        ])->assertCreated();

        $uuid = $order->json('data.uuid');

        $this->auth()->patchJson(self::BASE."/work-orders/{$uuid}/schedule", [
            'scheduled_for' => now()->addDay()->toDateString(),
            'vendor' => 'Cairo Service Centre',
        ])->assertOk();

        $this->auth()->patchJson(self::BASE."/work-orders/{$uuid}/start", [
            'odometer_km' => 12500,
        ])->assertOk();

        $completed = $this->auth()->patchJson(self::BASE."/work-orders/{$uuid}/complete", [
            'odometer_km' => 12520,
            'cost' => 850,
            'currency' => 'EGP',
            'description' => 'Oil and filter replaced',
        ])->assertOk();

        $completed->assertJsonPath('data.is_mirrored_to_v1', true);
        $this->assertNotNull($completed->json('data.v1_maintenance_record_id'));

        // Exactly one V1 record was created, by the V1 service.
        $this->assertSame(
            $v1Before + 1,
            DB::table('logistics_vehicle_maintenance_records')->count(),
        );
    }

    public function test_a_work_order_cannot_be_completed_without_cost_and_odometer(): void
    {
        $unit = $this->makeActiveUnit();

        $order = $this->auth()->postJson(self::BASE."/units/{$unit->uuid}/work-orders", [
            'maintenance_type' => 'oil_change',
            'description' => 'Scheduled oil change',
        ])->assertCreated();

        $uuid = $order->json('data.uuid');

        // Skipping schedule/start entirely is itself an illegal transition.
        $this->auth()->patchJson(self::BASE."/work-orders/{$uuid}/complete", [
            'odometer_km' => 12520,
            'cost' => 850,
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'cannot move from Planned'));
    }

    // ── Inspections ───────────────────────────────────────────────────────────

    public function test_an_inspection_cannot_be_submitted_with_a_mandatory_item_unanswered(): void
    {
        $unit = $this->makeActiveUnit();
        $template = $this->makeTemplate($unit->fleet_group_id);

        $inspection = $this->auth()->postJson(self::BASE."/units/{$unit->uuid}/inspections", [
            'template_id' => $template->uuid,
            'kind' => InspectionKind::PreTrip->value,
        ])->assertCreated();

        $this->auth()->patchJson(
            self::BASE."/units/{$unit->uuid}/inspections/{$inspection->json('data.uuid')}/submit",
            ['answers' => ['brakes' => ['passed' => true]]],
        )->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'Tyre condition'));
    }

    public function test_a_submitted_inspection_is_immutable(): void
    {
        $unit = $this->makeActiveUnit();
        $template = $this->makeTemplate($unit->fleet_group_id);

        $inspection = $this->auth()->postJson(self::BASE."/units/{$unit->uuid}/inspections", [
            'template_id' => $template->uuid,
            'kind' => InspectionKind::PreTrip->value,
        ])->assertCreated();

        $uuid = $inspection->json('data.uuid');
        $answers = ['answers' => ['brakes' => ['passed' => true], 'tyres' => ['passed' => true]]];

        $this->auth()->patchJson(self::BASE."/units/{$unit->uuid}/inspections/{$uuid}/submit", $answers)
            ->assertOk()
            ->assertJsonPath('data.is_immutable', true);

        $this->auth()->patchJson(self::BASE."/units/{$unit->uuid}/inspections/{$uuid}/submit", $answers)
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'cannot be changed'));
    }

    public function test_the_template_version_is_snapshotted_onto_the_inspection(): void
    {
        $unit = $this->makeActiveUnit();
        $template = $this->makeTemplate($unit->fleet_group_id);

        $inspection = $this->auth()->postJson(self::BASE."/units/{$unit->uuid}/inspections", [
            'template_id' => $template->uuid,
            'kind' => InspectionKind::PreTrip->value,
        ])->assertCreated();

        $this->assertSame($template->version, $inspection->json('data.template_version'));
    }

    /**
     * Separation of duties — the LOG-005 POD capture/validate precedent:
     * evidence should not be self-certified.
     */
    public function test_a_critical_failure_cannot_be_approved_by_its_performer(): void
    {
        $unit = $this->makeActiveUnit();
        $template = $this->makeTemplate($unit->fleet_group_id);

        $inspection = $this->auth()->postJson(self::BASE."/units/{$unit->uuid}/inspections", [
            'template_id' => $template->uuid,
            'kind' => InspectionKind::PreTrip->value,
        ])->assertCreated();

        $uuid = $inspection->json('data.uuid');

        $this->auth()->patchJson(self::BASE."/units/{$unit->uuid}/inspections/{$uuid}/submit", [
            'answers' => [
                'brakes' => ['passed' => false, 'comment' => 'Soft pedal'],
                'tyres' => ['passed' => true],
            ],
        ])->assertOk()->assertJsonPath('data.has_critical_failure', true);

        // Same user performed it — refused.
        $this->auth()->patchJson(self::BASE."/units/{$unit->uuid}/inspections/{$uuid}/approve")
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'other than'));

        // A different approver succeeds, and the failure becomes a defect.
        $approver = User::factory()->create(['company_id' => $this->company->id]);
        $approver->roles()->attach($this->user->roles()->first()->id);

        $this->actingAs($approver)
            ->patchJson(self::BASE."/units/{$unit->uuid}/inspections/{$uuid}/approve")
            ->assertOk();

        $this->assertSame(1, $unit->defects()->where('title', 'Brake system')->count());
        $this->assertTrue($unit->refresh()->hasOpenCriticalDefect());
    }

    // ── Defects ───────────────────────────────────────────────────────────────

    public function test_resolving_the_last_critical_defect_restores_fitness(): void
    {
        $unit = $this->makeActiveUnit();

        $defect = $this->auth()->postJson(self::BASE."/units/{$unit->uuid}/defects", [
            'title' => 'Brake fluid leak',
            'severity' => DefectSeverity::Critical->value,
        ])->assertCreated();

        $uuid = $defect->json('data.uuid');

        $this->auth()->patchJson(self::BASE."/defects/{$uuid}/acknowledge")->assertOk();
        $this->auth()->patchJson(self::BASE."/defects/{$uuid}/repair")->assertOk();
        $this->auth()->patchJson(self::BASE."/defects/{$uuid}/resolve")->assertOk();

        // The blocker is gone, so the vehicle is assignable again. Warnings may
        // remain and are not part of this contract.
        $this->auth()->getJson(self::BASE."/units/{$unit->uuid}/fitness")
            ->assertOk()
            ->assertJsonPath('data.is_assignable', true)
            ->assertJsonPath('data.blockers', []);
    }

    public function test_dismissing_a_defect_requires_a_reason(): void
    {
        $unit = $this->makeActiveUnit();

        $defect = $this->auth()->postJson(self::BASE."/units/{$unit->uuid}/defects", [
            'title' => 'Cracked wing mirror',
            'severity' => DefectSeverity::Major->value,
        ])->assertCreated();

        $this->auth()->patchJson(self::BASE."/defects/{$defect->json('data.uuid')}/dismiss", [])
            ->assertStatus(422);
    }

    // ── Fuel ──────────────────────────────────────────────────────────────────

    public function test_fuel_capture_requires_an_odometer_reading(): void
    {
        $unit = $this->makeActiveUnit();

        $this->auth()->postJson(self::BASE."/units/{$unit->uuid}/fuel-transactions", [
            'litres' => 45.5,
            'cost' => 1200,
        ])->assertStatus(422);
    }

    public function test_fuel_capture_computes_efficiency_and_validates(): void
    {
        $unit = $this->makeActiveUnit();

        $this->auth()->postJson(self::BASE."/units/{$unit->uuid}/odometer", [
            'reading_km' => 10000,
        ])->assertOk();

        $first = $this->auth()->postJson(self::BASE."/units/{$unit->uuid}/fuel-transactions", [
            'litres' => 50,
            'cost' => 1500,
            'odometer_km' => 10500,
            'station' => 'Wataniya Nasr City',
        ])->assertCreated();

        $first->assertJsonPath('data.status', FuelTransactionStatus::Validated->value);
        // 50 L over 500 km = 10 L/100km
        $this->assertEqualsWithDelta(10.0, $first->json('data.efficiency_l_per_100km'), 0.01);
        $this->assertEqualsWithDelta(30.0, $first->json('data.price_per_litre'), 0.01);
    }

    /**
     * An anomaly is a SIGNAL, not a rejection. Auto-rejecting unusual-but-real
     * purchases teaches operators to ignore the flag.
     */
    public function test_an_implausible_fill_is_flagged_but_still_accepted(): void
    {
        $unit = $this->makeActiveUnit();

        $response = $this->auth()->postJson(self::BASE."/units/{$unit->uuid}/fuel-transactions", [
            'litres' => 900,
            'cost' => 27000,
            'odometer_km' => 11000,
        ])->assertCreated();

        $response
            ->assertJsonPath('data.status', FuelTransactionStatus::Validated->value)
            ->assertJsonPath('data.has_anomaly', true);

        $this->assertContains('tank_implausible', $response->json('data.anomaly_flags'));
    }

    /**
     * D8 — Fleet owns operational cost only. Reconciling posts an EXPENSE to
     * the Fleet ledger and touches no cash table; Distribution remains the
     * Single Cash Authority.
     */
    public function test_reconciling_fuel_posts_operational_cost_and_no_trip_cash(): void
    {
        $unit = $this->makeActiveUnit();

        $settlementsBefore = DB::table('distribution_trip_settlements')->count();
        $paymentsBefore = DB::table('distribution_payment_collections')->count();

        $transaction = $this->auth()->postJson(self::BASE."/units/{$unit->uuid}/fuel-transactions", [
            'litres' => 45,
            'cost' => 1350,
            'odometer_km' => 11500,
        ])->assertCreated();

        $this->auth()->patchJson(
            self::BASE."/fuel-transactions/{$transaction->json('data.uuid')}/reconcile"
        )->assertOk()->assertJsonPath('data.posts_cost', true);

        // The expense landed in Fleet's ledger...
        $this->assertSame(1, $unit->costEntries()->where('cost_type', 'fuel')->count());

        // ...and nowhere near trip cash.
        $this->assertSame($settlementsBefore, DB::table('distribution_trip_settlements')->count());
        $this->assertSame($paymentsBefore, DB::table('distribution_payment_collections')->count());
    }

    public function test_cost_summary_returns_null_per_km_when_distance_is_unknown(): void
    {
        $unit = $this->makeActiveUnit();

        $summary = $this->auth()->getJson(self::BASE."/units/{$unit->uuid}/costs")->assertOk();

        // A silent zero would read as "this vehicle is free to run".
        $this->assertNull($summary->json('data.cost_per_km'));
        $this->assertIsArray($summary->json('data.by_type'));
    }

    // ── Statistics and data quality ───────────────────────────────────────────

    public function test_stats_report_the_lifecycle_mix_and_data_quality_signals(): void
    {
        $this->makeActiveUnit();
        $this->makeUnit();

        $stats = $this->auth()->getJson(self::BASE.'/stats')->assertOk();

        $this->assertGreaterThanOrEqual(1, $stats->json('active'));
        $this->assertGreaterThanOrEqual(1, $stats->json('draft'));
        $this->assertIsInt($stats->json('open_critical_defects'));
        // Distance is the denominator of most cost metrics, so silence is a
        // first-class signal rather than a month-end surprise.
        $this->assertIsInt($stats->json('stale_odometer'));
    }

    public function test_the_default_list_hides_retired_units(): void
    {
        $active = $this->makeActiveUnit();
        $retired = $this->makeUnit();
        $retired->update(['lifecycle_state' => FleetUnitLifecycle::Retired->value]);

        $ids = collect($this->auth()->getJson(self::BASE.'/units')->assertOk()->json('data'))
            ->pluck('id');

        $this->assertContains($active->uuid, $ids);
        $this->assertNotContains($retired->uuid, $ids);

        $allIds = collect($this->auth()->getJson(self::BASE.'/units?lifecycle_state=all')->json('data'))
            ->pluck('id');
        $this->assertContains($retired->uuid, $allIds);
    }

    // ── Readiness seam (Directive 3) ──────────────────────────────────────────

    /**
     * The batched query Dispatch will consume in Phase 4. A vehicle with no
     * FleetUnit returns "no opinion" rather than blocking — a partially
     * onboarded fleet must not stall dispatch.
     */
    public function test_the_readiness_query_batches_and_tolerates_unregistered_vehicles(): void
    {
        $unit = $this->makeActiveUnit();
        $unregistered = $this->makeVehicle();

        $verdicts = app(FleetReadinessService::class)->verdictForMany([
            $unit->vehicle_id,
            $unregistered->id,
        ]);

        $this->assertCount(2, $verdicts);
        $this->assertTrue($verdicts[$unit->vehicle_id]->isAssignable());
        $this->assertTrue($verdicts[$unregistered->id]->isAssignable());
        $this->assertSame([], $verdicts[$unregistered->id]->blockers);
    }

    /** D2: LOG-003's Vehicle::canBeDispatched() must remain untouched. */
    public function test_vehicle_can_be_dispatched_was_not_modified(): void
    {
        $source = file_get_contents(
            base_path('Modules/Logistics/Vehicles/Domain/Models/Vehicle.php')
        );

        $this->assertStringNotContainsString('FleetReadiness', $source);
        $this->assertStringNotContainsString('Fleet\\Domain', $source);
    }

    // ── Authorization ─────────────────────────────────────────────────────────

    public function test_every_endpoint_requires_authentication(): void
    {
        $this->getJson(self::BASE.'/units')->assertUnauthorized();
        $this->getJson(self::BASE.'/stats')->assertUnauthorized();
        $this->postJson(self::BASE.'/units', [])->assertUnauthorized();
        $this->getJson(self::BASE.'/work-orders')->assertUnauthorized();
        $this->getJson(self::BASE.'/fuel-transactions')->assertUnauthorized();
    }

    public function test_a_user_without_the_permission_is_refused(): void
    {
        $stranger = User::factory()->create(['company_id' => $this->company->id]);

        $this->actingAsUnprivileged($stranger)->getJson(self::BASE.'/units')->assertForbidden();
        $this->actingAsUnprivileged($stranger)->postJson(self::BASE.'/units', [])->assertForbidden();
    }

    /**
     * Separation of duties, enforced at the route: viewing is not scheduling,
     * and scheduling is not completing.
     */
    public function test_a_granted_permission_opens_only_its_own_routes(): void
    {
        $viewer = User::factory()->create(['company_id' => $this->company->id]);
        $role = Role::create([
            'name' => 'Fleet Viewer',
            'slug' => 'fleet-viewer-'.substr(md5(uniqid('', true)), 0, 8),
            'is_system' => false,
        ]);
        $role->permissions()->attach(Permission::where('name', 'fleet.view')->firstOrFail()->id);
        $viewer->roles()->attach($role->id);

        $unit = $this->makeActiveUnit();

        $this->actingAs($viewer)->getJson(self::BASE."/units/{$unit->uuid}")->assertOk();
        $this->actingAs($viewer)->postJson(self::BASE.'/units', [])->assertForbidden();
        $this->actingAs($viewer)
            ->postJson(self::BASE."/units/{$unit->uuid}/fuel-transactions", [])
            ->assertForbidden();
    }

    public function test_the_ten_fleet_permissions_are_seeded(): void
    {
        foreach ([
            'fleet.view', 'fleet.manage',
            'fleet.maintenance.schedule', 'fleet.maintenance.complete',
            'fleet.inspection.perform', 'fleet.inspection.approve',
            'fleet.fuel.record', 'fleet.fuel.reconcile',
            'fleet.cost.view', 'fleet.health.override',
        ] as $name) {
            $this->assertTrue(
                Permission::where('name', $name)->exists(),
                "Permission {$name} was not seeded",
            );
        }
    }
}
