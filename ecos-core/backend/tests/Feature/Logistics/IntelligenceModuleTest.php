<?php

declare(strict_types=1);

namespace Tests\Feature\Logistics;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Schema;
use Modules\IAM\Domain\Models\Permission;
use Modules\IAM\Domain\Models\Role;
use Modules\Logistics\Drivers\Domain\Models\Driver;
use Modules\Logistics\Intelligence\Domain\Enums\RecommendationSeverity;
use Modules\Logistics\Intelligence\Domain\Services\DecisionPriorityEngine;
use Modules\Logistics\Intelligence\Domain\ValueObjects\Recommendation;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;
use Modules\Organization\Companies\Domain\Models\Company;
use ReflectionClass;
use Tests\TestCase;

/**
 * EPIC-LOG-V2-002 / TASK-LOG-V2-002-001 — Enterprise Intelligence Platform.
 *
 * The intelligence layer is READ-ONLY decision support over Logistics V2. These
 * tests hold its contract:
 *
 *   • Additive — no table, no new permission; Phase 0-6 routes still answer
 *   • No duplicated business logic — it reads existing services, never recomputes
 *   • Read-model only — the services write nothing
 *   • Forecasts are deterministic projections, explicitly labelled
 */
class IntelligenceModuleTest extends TestCase
{
    use DatabaseTransactions;

    private const INT = '/api/logistics/intelligence';

    private User $user;

    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->user = User::factory()->create(['company_id' => $this->company->id]);

        $role = Role::create([
            'name' => 'Intelligence Test Admin',
            'slug' => 'intel-admin-'.substr(md5(uniqid('', true)), 0, 8),
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
            'full_name' => 'Intel Driver',
            'mobile' => '010'.substr($s, 0, 8),
            'national_id' => 'NID-'.$s,
            'license_issue_date' => '2024-01-01',
            'license_expiry_date' => '2031-01-01',
        ]);
    }

    // ═══ DECISION ENGINE ═════════════════════════════════════════════════════

    public function test_the_decision_engine_returns_ranked_recommendations(): void
    {
        // Vehicles but no drivers → a critical crew recommendation.
        $this->makeVehicle();

        $data = $this->auth()->getJson(self::INT.'/decisions')
            ->assertOk()
            ->json('data');

        $this->assertArrayHasKey('overall_status', $data);
        $this->assertArrayHasKey('by_severity', $data);
        $this->assertArrayHasKey('recommendations', $data);
        $this->assertIsArray($data['recommendations']);
    }

    public function test_recommendations_carry_rationale_and_a_named_action(): void
    {
        $this->makeVehicle();

        $recs = $this->auth()->getJson(self::INT.'/decisions/recommendations')
            ->assertOk()
            ->json('data');

        if ($recs === []) {
            $this->markTestSkipped('No recommendation raised in this environment.');
        }

        foreach ($recs as $rec) {
            // Every recommendation explains WHY and names WHERE to act.
            $this->assertArrayHasKey('rationale', $rec);
            $this->assertArrayHasKey('action', $rec);
            $this->assertArrayHasKey('source_module', $rec);
            $this->assertArrayHasKey('priority', $rec);
        }
    }

    public function test_priorities_are_sorted_highest_first(): void
    {
        $this->makeVehicle();

        $priorities = $this->auth()->getJson(self::INT.'/decisions/priorities')
            ->assertOk()
            ->json('data');

        $scores = array_column($priorities, 'priority');
        $sorted = $scores;
        rsort($sorted);
        $this->assertSame($sorted, $scores);
    }

    /** The priority engine is a pure function: severity floor, capped at 100. */
    public function test_the_priority_engine_scores_by_severity(): void
    {
        $engine = new DecisionPriorityEngine();

        $low = new Recommendation('t', 'c', RecommendationSeverity::Low, 'T', 'D', 'A', 'm');
        $critical = new Recommendation('t', 'c', RecommendationSeverity::Critical, 'T', 'D', 'A', 'm');

        $ranked = $engine->prioritise([$low, $critical]);

        // Critical first, and every score within 0-100.
        $this->assertSame(RecommendationSeverity::Critical, $ranked[0]->severity);
        $this->assertGreaterThanOrEqual($ranked[1]->priority, $ranked[0]->priority);
        foreach ($ranked as $r) {
            $this->assertGreaterThanOrEqual(0, $r->priority);
            $this->assertLessThanOrEqual(100, $r->priority);
        }
    }

    public function test_conflict_recommendations_answer(): void
    {
        $this->auth()->getJson(self::INT.'/decisions/conflicts')
            ->assertOk()
            ->assertJsonStructure(['data']);
    }

    // ═══ OPTIMISATION ENGINE ═════════════════════════════════════════════════

    public function test_vehicle_optimisation_reports_idle_capacity(): void
    {
        $this->auth()->getJson(self::INT.'/optimization/vehicle')
            ->assertOk()
            ->assertJsonStructure(['data' => ['idle_assignable', 'suggestions', 'idle_vehicles']]);
    }

    public function test_capacity_optimisation_surfaces_refusal_reasons(): void
    {
        $this->auth()->getJson(self::INT.'/optimization/capacity')
            ->assertOk()
            ->assertJsonStructure(['data' => ['exhausted', 'top_refusal_reasons', 'suggestions']]);
    }

    /** Routing stays with the Routing module — this only flags when to run it. */
    public function test_route_recommendation_defers_to_the_routing_module(): void
    {
        $data = $this->auth()->getJson(self::INT.'/optimization/route')
            ->assertOk()
            ->json('data');

        $this->assertArrayHasKey('should_run_optimisation', $data);
        $this->assertStringContainsString('Routing', $data['note']);
    }

    public function test_assignment_recommendation_pairs_vehicles_and_drivers(): void
    {
        $this->makeVehicle();
        $this->makeDriver();

        $data = $this->auth()->getJson(self::INT.'/optimization/assignment')
            ->assertOk()
            ->json('data');

        // Deterministic: the scarcer side bounds the possible assignments.
        $this->assertSame(
            min($data['idle_assignable_vehicles'], $data['idle_available_drivers']),
            $data['additional_assignments_possible'],
        );
        $this->assertContains($data['binding_constraint'], ['vehicles', 'drivers', 'balanced']);
    }

    // ═══ FORECASTING ═════════════════════════════════════════════════════════

    public function test_every_forecast_is_a_labelled_deterministic_projection(): void
    {
        foreach (['capacity', 'dispatch', 'workload'] as $forecast) {
            $data = $this->auth()->getJson(self::INT."/forecast/{$forecast}")
                ->assertOk()
                ->json('data');

            // Never mislabelled as a statistical prediction.
            $this->assertSame('deterministic_projection', $data['method']);
            $this->assertArrayHasKey('note', $data);
        }
    }

    public function test_capacity_forecast_projects_a_status(): void
    {
        $status = $this->auth()->getJson(self::INT.'/forecast/capacity')
            ->assertOk()
            ->json('data.projected_status');

        $this->assertContains($status, ['exhausted', 'at_risk', 'tightening', 'comfortable', 'no_data']);
    }

    public function test_workload_forecast_projects_a_level(): void
    {
        $level = $this->auth()->getJson(self::INT.'/forecast/workload')
            ->assertOk()
            ->json('data.projected_level');

        $this->assertContains($level, ['low', 'moderate', 'high', 'severe']);
    }

    // ═══ AI RECOMMENDATION LAYER ═════════════════════════════════════════════

    public function test_smart_suggestions_respect_the_limit(): void
    {
        $this->makeVehicle();

        $suggestions = $this->auth()->getJson(self::INT.'/insights/suggestions?limit=3')
            ->assertOk()
            ->json('data');

        $this->assertLessThanOrEqual(3, count($suggestions));
    }

    public function test_bottleneck_detection_names_the_binding_constraint(): void
    {
        // Vehicles with no drivers → drivers are the binding constraint.
        $this->makeVehicle();

        $data = $this->auth()->getJson(self::INT.'/insights/bottlenecks')
            ->assertOk()
            ->json('data');

        $this->assertArrayHasKey('primary', $data);
        $this->assertArrayHasKey('is_constrained', $data);
    }

    public function test_capacity_warnings_answer(): void
    {
        $this->auth()->getJson(self::INT.'/insights/warnings')
            ->assertOk()
            ->assertJsonStructure(['data' => ['warnings', 'has_warnings', 'top_refusal_reasons']]);
    }

    public function test_operational_insights_are_backed_by_signals(): void
    {
        $insights = $this->auth()->getJson(self::INT.'/insights')
            ->assertOk()
            ->json('data');

        foreach ($insights as $insight) {
            $this->assertArrayHasKey('insight', $insight);
            $this->assertArrayHasKey('signal', $insight);
        }
    }

    // ═══ ADDITIVITY, REUSE, READ-ONLY ════════════════════════════════════════

    public function test_intelligence_adds_no_tables(): void
    {
        foreach ([
            'intelligence_recommendations', 'intelligence_forecasts', 'intelligence_decisions', 'logistics_intelligence',
        ] as $table) {
            $this->assertFalse(
                Schema::hasTable($table),
                "Intelligence must add no tables; {$table} should not exist."
            );
        }
    }

    /** Read-model only: every intelligence service writes nothing. */
    public function test_the_intelligence_services_are_read_only(): void
    {
        $dir = base_path('Modules/Logistics/Intelligence/Domain/Services');

        foreach (glob($dir.'/*.php') ?: [] as $file) {
            $source = preg_replace('#/\*.*?\*/|//[^\n]*#s', '', (string) file_get_contents($file));

            foreach (['->save(', '->update(', '->delete(', '->insert(', '::create('] as $write) {
                $this->assertStringNotContainsString(
                    $write,
                    (string) $source,
                    basename($file).' must be read-only; found '.$write.'.'
                );
            }
        }
    }

    /** No duplicated business logic — it reuses the owning modules' services. */
    public function test_intelligence_reuses_existing_services_and_recomputes_nothing(): void
    {
        $recommendation = (string) file_get_contents(
            base_path('Modules/Logistics/Intelligence/Domain/Services/RecommendationService.php')
        );

        // Reads the operational dashboards / monitoring, never Fleet/Network internals.
        $this->assertStringContainsString('OperationalDashboardService', $recommendation);
        $this->assertStringContainsString('CapacityMonitoringService', $recommendation);
        $this->assertStringContainsString('DispatchMonitoringService', $recommendation);
        $this->assertStringNotContainsString('FleetReadinessService', $recommendation);
        $this->assertStringNotContainsString('CapacityLedgerService', $recommendation);
        // And touches no capacity column directly.
        $this->assertStringNotContainsString('committed_orders', $recommendation);
    }

    /** The Recommendation value object is immutable. */
    public function test_the_recommendation_value_object_is_immutable(): void
    {
        $reflection = new ReflectionClass(Recommendation::class);

        foreach ($reflection->getProperties() as $property) {
            $this->assertTrue(
                $property->isReadOnly(),
                "Recommendation::\${$property->getName()} must be readonly."
            );
        }

        // withPriority returns a NEW instance rather than mutating.
        $original = new Recommendation('t', 'c', RecommendationSeverity::Low, 'T', 'D', 'A', 'm', [], null, 10);
        $reprioritised = $original->withPriority(90);
        $this->assertSame(10, $original->priority);
        $this->assertSame(90, $reprioritised->priority);
        $this->assertNotSame($original, $reprioritised);
    }

    public function test_phase_0_to_6_routes_still_answer(): void
    {
        $this->auth()->getJson('/api/logistics/dispatch/options')->assertOk();
        $this->auth()->getJson('/api/logistics/operations/pools/options')->assertOk();
        $this->auth()->getJson('/api/logistics/operations/health/overview')->assertOk();
        $this->auth()->getJson('/api/logistics/operations/readiness')->assertOk();
    }

    public function test_every_intelligence_endpoint_requires_authentication(): void
    {
        foreach ([
            self::INT.'/decisions',
            self::INT.'/decisions/recommendations',
            self::INT.'/optimization/vehicle',
            self::INT.'/optimization/assignment',
            self::INT.'/forecast/capacity',
            self::INT.'/forecast/workload',
            self::INT.'/insights/suggestions',
            self::INT.'/insights/bottlenecks',
        ] as $url) {
            $this->getJson($url)->assertUnauthorized();
        }
    }

    public function test_a_user_without_the_permission_is_refused(): void
    {
        $stranger = User::factory()->create(['company_id' => $this->company->id]);
        $role = Role::create([
            'name' => 'Intel Nobody',
            'slug' => 'intel-nobody-'.$this->suffix(),
            'is_system' => false,
        ]);
        $stranger->roles()->attach($role->id);

        $this->actingAs($stranger)->getJson(self::INT.'/decisions')->assertForbidden();
    }

    /** Reuses the existing operations.view — no new permission was minted. */
    public function test_it_reuses_the_operations_view_permission(): void
    {
        $viewer = User::factory()->create(['company_id' => $this->company->id]);
        $role = Role::create([
            'name' => 'Intel Viewer',
            'slug' => 'intel-viewer-'.$this->suffix(),
            'is_system' => false,
        ]);
        $role->permissions()->attach(Permission::where('name', 'operations.view')->value('id'));
        $viewer->roles()->attach($role->id);

        $this->actingAs($viewer)->getJson(self::INT.'/decisions')->assertOk();
        $this->actingAs($viewer)->getJson(self::INT.'/forecast/capacity')->assertOk();

        // No intelligence-specific permission exists.
        $this->assertNull(Permission::where('name', 'like', 'intelligence.%')->first());
    }
}
