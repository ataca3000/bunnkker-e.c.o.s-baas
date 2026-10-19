<?php

declare(strict_types=1);

namespace Tests\Feature\Logistics;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Modules\IAM\Domain\Models\Permission;
use Modules\IAM\Domain\Models\Role;
use Modules\Logistics\Dispatch\Domain\Enums\AllocationStatus;
use Modules\Logistics\Dispatch\Domain\Enums\DispatchSessionStatus;
use Modules\Logistics\Dispatch\Domain\Models\DispatchAuditEntry;
use Modules\Logistics\Dispatch\Domain\Models\DispatchBoard;
use Modules\Logistics\Dispatch\Domain\Models\DispatchSession;
use Modules\Logistics\Dispatch\Domain\Models\DispatchTimelineEvent;
use Modules\Logistics\Dispatch\Domain\Models\ResourceAllocation;
use Modules\Logistics\Network\Domain\Models\CapacityPlan;
use Modules\Logistics\Network\Domain\Models\CapacitySlot;
use Modules\Logistics\Network\Domain\Models\ServiceArea;
use Modules\Logistics\Operations\Domain\Enums\ExceptionSeverity;
use Modules\Logistics\Operations\Domain\Enums\ExceptionSource;
use Modules\Logistics\Operations\Domain\Models\ExceptionNote;
use Modules\Logistics\Operations\Domain\Services\CapacityReservationService;
use Modules\Logistics\Operations\Domain\Services\ExceptionEscalationService;
use Modules\Logistics\Operations\Domain\Services\ExceptionRegistryService;
use Modules\Logistics\Operations\Domain\Enums\ExceptionCategory;
use Modules\Logistics\Network\Domain\Enums\CapacityUnit;
use Modules\Logistics\Drivers\Domain\Models\Driver;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * EPIC-LOG-V2-001 Phase 5 — Execution workspace, dashboards, alert center and
 * activity/audit.
 *
 * The whole phase is read-only aggregation over Phases 1-4. These tests exist to
 * hold the directives that matter here:
 *
 *   • Directive 3  — additive: Phase 0-4 routes still answer, no new table
 *   • Directive 13 — one writer per table: Phase 5 writes nothing
 *   • Directive 14 — no duplicated business logic: dashboards call the owners
 *   • Alerts C     — reuse the Phase 4 registry; no second alert engine
 */
class Phase5ModuleTest extends TestCase
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
            'name' => 'Phase 5 Test Admin',
            'slug' => 'phase5-admin-'.substr(md5(uniqid('', true)), 0, 8),
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

    // ── Fixtures ──────────────────────────────────────────────────────────────

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
            'full_name' => 'Phase 5 Driver',
            'mobile' => '010'.substr($s, 0, 8),
            'national_id' => 'NID-'.$s,
            'license_issue_date' => '2024-01-01',
            'license_expiry_date' => '2031-01-01',
        ]);
    }

    private function makeBoard(): DispatchBoard
    {
        return DispatchBoard::create([
            'company_id' => $this->company->id,
            'board_date' => now()->toDateString(),
        ]);
    }

    private function makeSession(DispatchSessionStatus $status = DispatchSessionStatus::Closed): DispatchSession
    {
        return DispatchSession::create([
            'company_id' => $this->company->id,
            'dispatch_board_id' => $this->makeBoard()->id,
            'status' => $status->value,
            'mode' => DispatchSession::MODE_MANUAL,
            'operator_name' => 'Test Operator',
            'started_at' => now()->subHour(),
            'ended_at' => $status === DispatchSessionStatus::Closed ? now() : null,
        ]);
    }

    private function seedActivity(): void
    {
        DispatchTimelineEvent::create([
            'company_id' => $this->company->id,
            'event_type' => 'session_opened',
            'severity' => 'info',
            'title' => 'Session opened',
            'occurred_at' => now()->subMinutes(10),
            'actor_name' => 'Test Operator',
        ]);

        DispatchAuditEntry::create([
            'company_id' => $this->company->id,
            'action' => 'assignment_override',
            'reason' => 'Manual override of a blocked assignment.',
            'performed_at' => now()->subMinutes(5),
            'actor_name' => 'Test Operator',
        ]);

        $exception = app(ExceptionRegistryService::class)->record(
            source: ExceptionSource::Operations,
            category: ExceptionCategory::Resource,
            exceptionType: 'pool_below_strength',
            severity: ExceptionSeverity::Warning,
            title: 'Pool below strength',
            dedupKey: 'phase5:'.$this->suffix(),
            companyId: $this->company->id,
        );

        app(ExceptionEscalationService::class)->escalate($exception, 'Nobody picked it up.');

        ExceptionNote::create([
            'company_id' => $this->company->id,
            'exception_id' => $exception->id,
            'body' => 'Called the depot.',
            'note_type' => ExceptionNote::TYPE_NOTE,
            'written_at' => now()->subMinutes(2),
            'author_name' => 'Test Operator',
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

    // ═══ B. DASHBOARDS ═══════════════════════════════════════════════════════

    public function test_fleet_dashboard_is_self_consistent(): void
    {
        $this->makeVehicle();
        $this->makeVehicle();

        $data = $this->auth()->getJson(self::OPS.'/dashboards/fleet')
            ->assertOk()
            ->json('data');

        $this->assertGreaterThanOrEqual(2, $data['total_vehicles']);
        // No allocations exist, so nothing is in use.
        $this->assertSame(0, $data['in_use_now']);
        $this->assertSame($data['assignable'], $data['idle_assignable']);
        // Utilisation is a snapshot: 0 when assignable, null when there is none.
        // (Loose compare — JSON serialises 0.0 as 0.)
        if ($data['assignable'] > 0) {
            $this->assertEquals(0, $data['utilisation_now']);
        } else {
            $this->assertNull($data['utilisation_now']);
        }
        // Idle vehicles are named, not just counted (BO-1).
        $this->assertIsArray($data['idle_vehicles']);
    }

    public function test_a_held_allocation_shows_up_as_in_use(): void
    {
        $vehicle = $this->makeVehicle();
        $driver = $this->makeDriver();

        $before = $this->auth()->getJson(self::OPS.'/dashboards/fleet')->json('data');

        // Only assignable vehicles can be counted in use; skip if the fixture
        // vehicle is not assignable in this environment.
        if ($before['assignable'] === 0) {
            $this->markTestSkipped('No assignable vehicle in this environment.');
        }

        ResourceAllocation::create([
            'company_id' => $this->company->id,
            'dispatch_session_id' => $this->makeSession(DispatchSessionStatus::Open)->id,
            'trip_id' => null,
            'vehicle_id' => $vehicle->id,
            'driver_id' => $driver->id,
            'status' => AllocationStatus::Confirmed->value,
            'allocation_mode' => ResourceAllocation::MODE_MANUAL,
            'allocated_at' => now(),
        ]);

        $after = $this->auth()->getJson(self::OPS.'/dashboards/fleet')->json('data');

        $this->assertSame($before['in_use_now'] + 1, $after['in_use_now']);
        $this->assertSame($after['assignable'] - $after['in_use_now'], $after['idle_assignable']);
    }

    public function test_driver_dashboard_is_self_consistent(): void
    {
        $this->makeDriver();

        $data = $this->auth()->getJson(self::OPS.'/dashboards/drivers')
            ->assertOk()
            ->json('data');

        $this->assertGreaterThanOrEqual(1, $data['total_drivers']);
        $this->assertSame(0, $data['in_use_now']);
        $this->assertSame($data['available'], $data['idle_available']);
    }

    public function test_capacity_dashboard_reads_the_ledger(): void
    {
        $this->auth()->getJson(self::OPS.'/dashboards/capacity')
            ->assertOk()
            ->assertJsonStructure(['data' => ['slots' => ['avg_utilisation', 'exhausted'], 'reservations']]);
    }

    /** DIRECTIVE 7 — dispatch figures are Phase 3's, reported not recomputed. */
    public function test_dispatch_dashboard_is_phase_3s_figures(): void
    {
        $this->auth()->getJson(self::OPS.'/dashboards/dispatch')
            ->assertOk()
            ->assertJsonStructure(['data' => ['kpis' => ['confirmation_rate'], 'queue', 'assignment']]);
    }

    public function test_kpi_dashboard_rolls_up_the_headline(): void
    {
        $this->auth()->getJson(self::OPS.'/dashboards/kpi')
            ->assertOk()
            ->assertJsonStructure([
                'data' => ['headline', 'is_quiet', 'pools' => ['fieldable'], 'dispatch'],
            ]);
    }

    /** No predictive analytics — operational snapshots only. */
    public function test_no_dashboard_service_forecasts_anything(): void
    {
        $source = (string) file_get_contents(
            base_path('Modules/Logistics/Operations/Domain/Services/OperationalDashboardService.php')
        );
        $source = preg_replace('#/\*.*?\*/|//[^\n]*#s', '', $source);

        foreach (['forecast', 'predict', 'projection', 'machineLearning'] as $banned) {
            $this->assertStringNotContainsStringIgnoringCase($banned, (string) $source);
        }
    }

    /** DIRECTIVE 14 — dashboards call the owners rather than recomputing. */
    public function test_the_dashboard_service_delegates_to_the_owning_modules(): void
    {
        $source = (string) file_get_contents(
            base_path('Modules/Logistics/Operations/Domain/Services/OperationalDashboardService.php')
        );

        $this->assertStringContainsString('ResourcePoolService', $source);
        $this->assertStringContainsString('DispatchMonitoringService', $source);
        $this->assertStringContainsString('CapacityMonitoringService', $source);
    }

    // ═══ D. ACTIVITY, AUDIT, HISTORY ═════════════════════════════════════════

    public function test_the_timeline_merges_every_source_newest_first(): void
    {
        $this->seedActivity();

        // Default window is the last day, which covers the seeded rows.
        $data = $this->auth()->getJson(self::OPS.'/activity/timeline')
            ->assertOk()
            ->json('data');

        $this->assertGreaterThanOrEqual(4, count($data['items']));

        // Newest first.
        $times = array_column($data['items'], 'occurred_at');
        $sorted = $times;
        rsort($sorted);
        $this->assertSame($sorted, $times);

        // Sources are tagged so an operator knows where each row came from.
        $sources = array_unique(array_column($data['items'], 'source'));
        $this->assertContains('dispatch_timeline', $sources);
        $this->assertContains('escalation', $sources);
    }

    public function test_the_timeline_can_be_filtered_to_one_source(): void
    {
        $this->seedActivity();

        $data = $this->auth()->getJson(self::OPS.'/activity/timeline?source=escalation')
            ->assertOk()
            ->json('data');

        foreach ($data['items'] as $item) {
            $this->assertSame('escalation', $item['source']);
        }
    }

    public function test_the_timeline_can_be_filtered_by_severity(): void
    {
        $this->seedActivity();

        $data = $this->auth()->getJson(self::OPS.'/activity/timeline?severity=warning')
            ->assertOk()
            ->json('data');

        foreach ($data['items'] as $item) {
            $this->assertSame('warning', $item['severity']);
        }
    }

    /** Truncation is never silent — the response always states what it dropped. */
    public function test_the_timeline_reports_its_truncation_shape(): void
    {
        $this->auth()->getJson(self::OPS.'/activity/timeline')
            ->assertOk()
            ->assertJsonStructure([
                'data' => ['items', 'returned', 'available', 'truncated_sources', 'window_truncated'],
            ]);
    }

    /** The audit explorer is who-did-what-and-why: audit sources only. */
    public function test_the_audit_explorer_shows_only_audit_sources(): void
    {
        $this->seedActivity();

        $data = $this->auth()->getJson(self::OPS.'/activity/audit')
            ->assertOk()
            ->json('data');

        foreach ($data['items'] as $item) {
            $this->assertContains($item['source'], ['dispatch_audit', 'capacity_audit']);
        }
    }

    public function test_session_history_includes_closed_sessions(): void
    {
        $this->makeSession(DispatchSessionStatus::Closed);

        $statuses = $this->auth()->getJson(self::OPS.'/activity/history/sessions')
            ->assertOk()
            ->json('data.*.status');

        $this->assertContains('closed', $statuses);
    }

    public function test_assignment_history_reads_allocations(): void
    {
        ResourceAllocation::create([
            'company_id' => $this->company->id,
            'dispatch_session_id' => $this->makeSession()->id,
            'trip_id' => null,
            'vehicle_id' => $this->makeVehicle()->id,
            'driver_id' => $this->makeDriver()->id,
            'status' => AllocationStatus::Confirmed->value,
            'allocation_mode' => ResourceAllocation::MODE_MANUAL,
            'allocated_at' => now(),
        ]);

        $this->auth()->getJson(self::OPS.'/activity/history/assignments')
            ->assertOk()
            ->assertJsonPath('data.0.status', 'confirmed')
            ->assertJsonStructure(['data' => [['fleet_verdict', 'allocated_at']]]);
    }

    public function test_capacity_history_includes_refused_reservations(): void
    {
        $slot = $this->makeSlot(5);

        // A refusal — the interesting row a history must keep.
        try {
            app(CapacityReservationService::class)->request(
                $slot,
                [CapacityUnit::Orders->value => 500.0],
                actorId: $this->user->id,
            );
        } catch (\Throwable) {
            // Expected: the ledger refuses, leaving a Failed reservation.
        }

        $statuses = $this->auth()->getJson(self::OPS.'/activity/history/capacity')
            ->assertOk()
            ->json('data.*.status');

        $this->assertContains('failed', $statuses);
    }

    // ═══ C. ALERT CENTER (reuses the Phase 4 registry) ═══════════════════════

    /**
     * The alert center reads the Phase 4 registry — there is no second engine.
     * Alert history is just resolved exceptions, via the same index.
     */
    public function test_the_alert_center_reuses_the_phase_4_registry(): void
    {
        app(ExceptionRegistryService::class)->record(
            source: ExceptionSource::Operations,
            category: ExceptionCategory::Resource,
            exceptionType: 'pool_below_strength',
            severity: ExceptionSeverity::Critical,
            title: 'Critical pool shortfall',
            dedupKey: 'phase5-alert:'.$this->suffix(),
            companyId: $this->company->id,
        );

        // Live alerts come from the Phase 4 endpoint.
        $this->auth()->getJson(self::OPS.'/exceptions/alerts')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        // There is no second alert table.
        $this->assertFalse(Schema::hasTable('ops_alerts'));
        $this->assertFalse(Schema::hasTable('ops_alert_center'));
    }

    // ═══ ADDITIVITY & ACCESS CONTROL ═════════════════════════════════════════

    /** DIRECTIVE 3 — additive: Phase 5 creates no table and no writer. */
    public function test_phase_5_adds_no_tables(): void
    {
        // The read surfaces union existing append-only tables; there is nothing
        // new to store.
        foreach (['ops_activity', 'ops_activity_log', 'ops_dashboards', 'ops_timeline'] as $table) {
            $this->assertFalse(
                Schema::hasTable($table),
                "Phase 5 must add no tables; {$table} should not exist."
            );
        }
    }

    /** The read services never write. */
    public function test_the_read_services_are_read_only(): void
    {
        foreach (['ActivityTimelineService', 'OperationalDashboardService', 'OperationalHistoryService'] as $service) {
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

    public function test_phase_0_to_4_routes_still_answer(): void
    {
        $this->auth()->getJson('/api/logistics/dispatch/options')->assertOk();
        $this->auth()->getJson('/api/logistics/dispatch/ops/options')->assertOk();
        $this->auth()->getJson(self::OPS.'/pools/options')->assertOk();
        $this->auth()->getJson(self::OPS.'/health/overview')->assertOk();
        $this->auth()->getJson(self::OPS.'/exceptions/options')->assertOk();
    }

    public function test_every_phase_5_endpoint_requires_authentication(): void
    {
        foreach ([
            self::OPS.'/dashboards/fleet',
            self::OPS.'/dashboards/drivers',
            self::OPS.'/dashboards/capacity',
            self::OPS.'/dashboards/dispatch',
            self::OPS.'/dashboards/kpi',
            self::OPS.'/activity/timeline',
            self::OPS.'/activity/audit',
            self::OPS.'/activity/history/assignments',
            self::OPS.'/activity/history/sessions',
            self::OPS.'/activity/history/capacity',
        ] as $url) {
            $this->getJson($url)->assertUnauthorized();
        }
    }

    public function test_a_user_without_the_permission_is_refused(): void
    {
        $stranger = User::factory()->create(['company_id' => $this->company->id]);
        $role = Role::create([
            'name' => 'Phase 5 Nobody',
            'slug' => 'phase5-nobody-'.$this->suffix(),
            'is_system' => false,
        ]);
        $stranger->roles()->attach($role->id);

        $this->actingAs($stranger)->getJson(self::OPS.'/dashboards/fleet')->assertForbidden();
    }

    /** The audit explorer takes the audit-view permission, not plain view. */
    public function test_the_audit_explorer_requires_the_audit_permission(): void
    {
        $viewer = User::factory()->create(['company_id' => $this->company->id]);
        $role = Role::create([
            'name' => 'Phase 5 Viewer',
            'slug' => 'phase5-viewer-'.$this->suffix(),
            'is_system' => false,
        ]);
        $role->permissions()->attach(Permission::where('name', 'operations.view')->value('id'));
        $viewer->roles()->attach($role->id);

        // Plain view reaches the timeline...
        $this->actingAs($viewer)->getJson(self::OPS.'/activity/timeline')->assertOk();
        // ...but not the audit explorer.
        $this->actingAs($viewer)->getJson(self::OPS.'/activity/audit')->assertForbidden();
    }
}
