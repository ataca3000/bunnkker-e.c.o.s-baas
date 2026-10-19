<?php

declare(strict_types=1);

namespace Tests\Feature\Logistics;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Schema;
use Modules\IAM\Domain\Models\Role;
use Modules\Logistics\Drivers\Domain\Models\Driver;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * EPIC-LOG-V2-001 Phase 6 — Enterprise Readiness & Operational Completion.
 *
 * The final read-model layer. These tests hold the directives that define it:
 *
 *   • Directive 3  — additive: Phase 0-5 routes answer, no new table
 *   • Directive 4  — no duplicated business logic: it interprets, never computes
 *   • Directive 6/7 — readiness reads Fleet and Network; it calculates neither
 *   • Directive 14 — one writer per table: Phase 6 writes nothing
 *   • Directive 16 — reuse every existing service first
 *   • Performance  — read-model only, no materialised table
 */
class Phase6ModuleTest extends TestCase
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
            'name' => 'Phase 6 Test Admin',
            'slug' => 'phase6-admin-'.substr(md5(uniqid('', true)), 0, 8),
            'is_system' => true,
        ]);
        $this->user->roles()->attach($role->id);
    }

    private function auth(): static
    {
        return $this->actingAs($this->user);
    }

    private function suffix(): string
    {
        return substr(md5(uniqid('', true)), 0, 8);
    }

    private function makeVehicle(): Vehicle
    {
        $s = $this->suffix();

        return Vehicle::create([
            'vehicle_code' => 'VEH-'.$s,
            'plate_number' => 'PL-'.$s,
            'type' => 'van',
            'capacity_orders' => 60,
            'company_id' => $this->company->id,
        ]);
    }

    private function makeDriver(): Driver
    {
        $s = $this->suffix();

        return Driver::create([
            'driver_code' => 'DRV-'.$s,
            'full_name' => 'Phase 6 Driver',
            'mobile' => '010'.substr($s, 0, 8),
            'national_id' => 'NID-'.$s,
            'license_issue_date' => '2024-01-01',
            'license_expiry_date' => '2031-01-01',
        ]);
    }

    // ═══ B. CROSS-MODULE VALIDATION ══════════════════════════════════════════

    public function test_the_report_validates_all_five_authorities(): void
    {
        $modules = $this->auth()->getJson(self::OPS.'/readiness/validate')
            ->assertOk()
            ->json('data.modules.*.module');

        $this->assertEqualsCanonicalizing(
            ['fleet', 'drivers', 'capacity', 'dispatch', 'operations'],
            $modules,
        );
    }

    /**
     * DIRECTIVE 6/7 — a fresh company has no vehicles and no drivers, so Fleet
     * and Drivers report NOT ready. Validation reads that; it does not invent it.
     */
    public function test_an_empty_company_is_not_ready(): void
    {
        $report = $this->auth()->getJson(self::OPS.'/readiness/validate')
            ->assertOk()
            ->json('data');

        $this->assertSame('not_ready', $report['overall_status']);

        $fleet = collect($report['modules'])->firstWhere('module', 'fleet');
        $this->assertSame('not_ready', $fleet['status']);
        // The reason is stated in words, not just a flag.
        $this->assertNotEmpty($fleet['reasons']);
    }

    public function test_worst_module_status_wins_the_overall(): void
    {
        // Every module is degraded-or-worse for an empty company; the overall
        // must be the worst, never an average.
        $report = $this->auth()->getJson(self::OPS.'/readiness/validate')->json('data');

        $statuses = array_column($report['modules'], 'status');
        $this->assertContains('not_ready', $statuses);
        $this->assertSame('not_ready', $report['overall_status']);
    }

    public function test_a_single_module_can_be_validated(): void
    {
        $this->auth()->getJson(self::OPS.'/readiness/validate/dispatch')
            ->assertOk()
            ->assertJsonPath('data.module', 'dispatch')
            ->assertJsonStructure(['data' => ['status', 'checks', 'reasons']]);
    }

    public function test_an_unknown_module_is_a_404(): void
    {
        $this->auth()->getJson(self::OPS.'/readiness/validate/teleporter')
            ->assertStatus(404);
    }

    // ═══ A. OPERATIONAL READINESS ════════════════════════════════════════════

    public function test_the_readiness_dashboard_carries_a_bounded_score(): void
    {
        $data = $this->auth()->getJson(self::OPS.'/readiness')
            ->assertOk()
            ->json('data');

        $this->assertGreaterThanOrEqual(0, $data['health_score']);
        $this->assertLessThanOrEqual(100, $data['health_score']);
        $this->assertArrayHasKey('overall_status', $data);
        $this->assertNotEmpty($data['modules']);
        $this->assertNotEmpty($data['checklist']);
    }

    public function test_the_health_score_is_lower_for_an_emptier_operation(): void
    {
        $empty = $this->auth()->getJson(self::OPS.'/readiness/health-score')->json('data.score');

        // Adding a vehicle and a driver can only help — the score must not fall.
        $this->makeVehicle();
        $this->makeDriver();

        $withResources = $this->auth()->getJson(self::OPS.'/readiness/health-score')->json('data.score');

        $this->assertGreaterThanOrEqual($empty, $withResources);
    }

    public function test_the_health_score_carries_a_grade(): void
    {
        $data = $this->auth()->getJson(self::OPS.'/readiness/health-score')
            ->assertOk()
            ->json('data');

        $this->assertContains($data['grade'], ['A', 'B', 'C', 'D', 'F']);
        // The weights are stated in the open, not hidden in a table.
        $this->assertArrayHasKey('weights', $data);
    }

    public function test_the_checklist_flattens_every_check_and_names_blockers(): void
    {
        $data = $this->auth()->getJson(self::OPS.'/readiness/checklist')
            ->assertOk()
            ->json('data');

        $this->assertSame($data['total'], count($data['items']));
        $this->assertLessThanOrEqual($data['total'], $data['passed']);
        // An empty company fails a blocking check (no vehicles), so blockers
        // must be called out.
        $this->assertNotEmpty($data['blocking_failures']);
    }

    public function test_the_module_summary_is_one_line_per_authority(): void
    {
        $modules = $this->auth()->getJson(self::OPS.'/readiness/modules')
            ->assertOk()
            ->json('data.modules');

        $this->assertCount(5, $modules);
        foreach ($modules as $module) {
            $this->assertArrayHasKey('status', $module);
            $this->assertArrayHasKey('weight', $module);
        }
    }

    // ═══ C. DIAGNOSTICS ══════════════════════════════════════════════════════

    public function test_the_diagnostics_center_returns_every_projection(): void
    {
        $this->auth()->getJson(self::OPS.'/diagnostics')
            ->assertOk()
            ->assertJsonStructure([
                'data' => ['system', 'dependencies', 'queue', 'capacity', 'dispatch', 'exceptions'],
            ]);
    }

    /** Dependency health IS the cross-module validation, re-presented. */
    public function test_dependency_health_lists_the_upstream_authorities(): void
    {
        $deps = $this->auth()->getJson(self::OPS.'/diagnostics/dependencies')
            ->assertOk()
            ->json('data.dependencies.*.name');

        $this->assertEqualsCanonicalizing(
            ['fleet', 'drivers', 'capacity', 'dispatch', 'operations'],
            $deps,
        );
    }

    public function test_each_diagnostic_projection_carries_a_status(): void
    {
        foreach (['system', 'queue', 'capacity', 'dispatch', 'exceptions'] as $view) {
            $this->auth()->getJson(self::OPS."/diagnostics/{$view}")
                ->assertOk()
                ->assertJsonStructure(['data' => ['status']]);
        }
    }

    // ═══ D. ENTERPRISE SUMMARY ═══════════════════════════════════════════════

    public function test_the_executive_summary_carries_score_and_status(): void
    {
        $this->auth()->getJson(self::OPS.'/summary/executive')
            ->assertOk()
            ->assertJsonStructure(['data' => ['health_score', 'grade', 'overall_status', 'headline']]);
    }

    public function test_every_summary_endpoint_answers(): void
    {
        foreach (['executive', 'today', 'capacity', 'dispatch', 'fleet', 'exceptions'] as $view) {
            $this->auth()->getJson(self::OPS."/summary/{$view}")->assertOk();
        }
    }

    public function test_the_fleet_summary_pairs_vehicles_and_drivers(): void
    {
        $this->auth()->getJson(self::OPS.'/summary/fleet')
            ->assertOk()
            ->assertJsonStructure([
                'data' => ['vehicles' => ['assignable'], 'drivers' => ['available'], 'fieldable_units'],
            ]);
    }

    // ═══ ADDITIVITY, REUSE & ACCESS CONTROL ══════════════════════════════════

    /** DIRECTIVE 3 / performance — read-model only, no materialised table. */
    public function test_phase_6_adds_no_tables(): void
    {
        foreach ([
            'ops_readiness', 'ops_readiness_scores', 'ops_diagnostics', 'ops_validation', 'ops_summaries',
        ] as $table) {
            $this->assertFalse(
                Schema::hasTable($table),
                "Phase 6 must add no tables; {$table} should not exist."
            );
        }
    }

    /** DIRECTIVE 14 — Phase 6 writes nothing. */
    public function test_the_phase_6_services_are_read_only(): void
    {
        foreach ([
            'CrossModuleValidationService',
            'ReadinessValidationService',
            'DiagnosticsService',
            'EnterpriseSummaryService',
        ] as $service) {
            $source = (string) file_get_contents(
                base_path("Modules/Logistics/Operations/Domain/Services/{$service}.php")
            );
            $source = preg_replace('#/\*.*?\*/|//[^\n]*#s', '', $source);

            foreach (['->save(', '->update(', '->create(', '->delete(', '->insert('] as $write) {
                $this->assertStringNotContainsString(
                    $write,
                    (string) $source,
                    "{$service} must be read-only; found {$write}."
                );
            }
        }
    }

    /**
     * DIRECTIVE 4/6/7 — readiness must not calculate Fleet readiness or Network
     * capacity itself. It reaches them only through the existing services.
     */
    public function test_validation_does_not_recompute_fleet_or_capacity(): void
    {
        $source = (string) file_get_contents(
            base_path('Modules/Logistics/Operations/Domain/Services/CrossModuleValidationService.php')
        );

        // It reads the existing dashboards/monitoring, never Fleet/Network internals.
        $this->assertStringContainsString('OperationalDashboardService', $source);
        $this->assertStringContainsString('CapacityMonitoringService', $source);
        $this->assertStringContainsString('DispatchMonitoringService', $source);
        $this->assertStringNotContainsString('FleetReadinessService', $source);
        $this->assertStringNotContainsString('CapacityLedgerService', $source);
    }

    /** DIRECTIVE 16 — reuse: the summaries digest existing services. */
    public function test_the_summary_service_reuses_existing_monitoring(): void
    {
        $source = (string) file_get_contents(
            base_path('Modules/Logistics/Operations/Domain/Services/EnterpriseSummaryService.php')
        );

        $this->assertStringContainsString('OperationalDashboardService', $source);
        $this->assertStringContainsString('DispatchMonitoringService', $source);
        $this->assertStringContainsString('CapacityMonitoringService', $source);
    }

    public function test_phase_0_to_5_routes_still_answer(): void
    {
        $this->auth()->getJson('/api/logistics/dispatch/options')->assertOk();
        $this->auth()->getJson(self::OPS.'/pools/options')->assertOk();
        $this->auth()->getJson(self::OPS.'/health/overview')->assertOk();
        $this->auth()->getJson(self::OPS.'/dashboards/kpi')->assertOk();
        $this->auth()->getJson(self::OPS.'/activity/timeline')->assertOk();
    }

    public function test_every_phase_6_endpoint_requires_authentication(): void
    {
        foreach ([
            self::OPS.'/readiness',
            self::OPS.'/readiness/health-score',
            self::OPS.'/readiness/validate',
            self::OPS.'/diagnostics',
            self::OPS.'/diagnostics/system',
            self::OPS.'/summary/executive',
            self::OPS.'/summary/fleet',
        ] as $url) {
            $this->getJson($url)->assertUnauthorized();
        }
    }

    public function test_a_user_without_the_permission_is_refused(): void
    {
        $stranger = User::factory()->create(['company_id' => $this->company->id]);
        $role = Role::create([
            'name' => 'Phase 6 Nobody',
            'slug' => 'phase6-nobody-'.$this->suffix(),
            'is_system' => false,
        ]);
        $stranger->roles()->attach($role->id);

        $this->actingAs($stranger)->getJson(self::OPS.'/readiness')->assertForbidden();
        $this->actingAs($stranger)->getJson(self::OPS.'/diagnostics')->assertForbidden();
        $this->actingAs($stranger)->getJson(self::OPS.'/summary/executive')->assertForbidden();
    }
}
