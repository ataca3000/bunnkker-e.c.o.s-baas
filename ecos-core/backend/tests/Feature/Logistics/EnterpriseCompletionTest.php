<?php

declare(strict_types=1);

namespace Tests\Feature\Logistics;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Modules\IAM\Domain\Models\Permission;
use Modules\IAM\Domain\Models\Role;
use Modules\Logistics\Drivers\Domain\Models\Driver;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * EPIC-LOG-V2-002 / TASK-LOG-V2-002-003 — Enterprise Completion.
 *
 * The Enterprise Workspace aggregated dashboards, plus the production-readiness
 * guarantees they must hold:
 *
 *   • One aggregated read per dashboard (round-trip reduction)
 *   • Company-scoped from the authenticated user — no cross-company leakage
 *   • Additive, read-only; the whole V2 surface still answers
 */
class EnterpriseCompletionTest extends TestCase
{
    use DatabaseTransactions;

    private const BASE = '/api/logistics/intelligence/dashboard';

    private User $user;

    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->user = User::factory()->create(['company_id' => $this->company->id]);

        $role = Role::create([
            'name' => 'Completion Test Admin',
            'slug' => 'completion-admin-'.substr(md5(uniqid('', true)), 0, 8),
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

    private function makeVehicle(Company $company): Vehicle
    {
        $s = $this->suffix();

        return Vehicle::create([
            'vehicle_code' => 'VEH-'.$s,
            'plate_number' => 'PL-'.$s,
            'type' => 'van',
            'capacity_orders' => 60,
            'company_id' => $company->id,
        ]);
    }

    private function makeDriver(): Driver
    {
        $s = $this->suffix();

        return Driver::create([
            'driver_code' => 'DRV-'.$s,
            'full_name' => 'Completion Driver',
            'mobile' => '010'.substr($s, 0, 8),
            'national_id' => 'NID-'.$s,
            'license_issue_date' => '2024-01-01',
            'license_expiry_date' => '2031-01-01',
        ]);
    }

    // ═══ AGGREGATED DASHBOARDS ═══════════════════════════════════════════════

    public function test_the_executive_dashboard_is_one_aggregated_read(): void
    {
        $this->auth()->getJson(self::BASE.'/executive')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'health' => ['score', 'grade', 'overall_status'],
                    'is_quiet',
                    'headline' => ['critical_alerts', 'fieldable_units'],
                    'decisions' => ['total', 'by_severity', 'top_priority'],
                    'forecasts' => ['capacity', 'dispatch_pressure', 'workload'],
                ],
            ]);
    }

    public function test_the_operations_dashboard_is_one_aggregated_read(): void
    {
        $this->auth()->getJson(self::BASE.'/operations')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'overall_status',
                    'modules',
                    'suggestions',
                    'capacity_warnings',
                    'automation' => ['consumer_count', 'policy_count'],
                ],
            ]);
    }

    public function test_operations_dashboard_lists_the_five_authorities(): void
    {
        $modules = $this->auth()->getJson(self::BASE.'/operations')
            ->assertOk()
            ->json('data.modules.*.module');

        $this->assertEqualsCanonicalizing(
            ['fleet', 'drivers', 'capacity', 'dispatch', 'operations'],
            $modules,
        );
    }

    // ═══ SECURITY — COMPANY ISOLATION ════════════════════════════════════════

    /**
     * The dashboard is scoped to the authenticated user's company. Another
     * company's resources must never leak in.
     */
    public function test_the_dashboard_does_not_leak_another_companys_data(): void
    {
        // Another company, fully resourced.
        $other = Company::factory()->create();
        $this->makeVehicle($other);
        $this->makeVehicle($other);
        $this->makeDriver();

        // Our company has nothing.
        $data = $this->auth()->getJson(self::BASE.'/executive')
            ->assertOk()
            ->json('data');

        // Our operation is empty — the other company's vehicles are not counted.
        $this->assertSame(0, $data['headline']['fieldable_units']);
    }

    /**
     * The company is taken from the authenticated user, never a request
     * parameter — a forged company_id is ignored.
     */
    public function test_a_forged_company_id_is_ignored(): void
    {
        $other = Company::factory()->create();
        $this->makeVehicle($other);
        $this->makeVehicle($other);
        $this->makeDriver();

        // Try to force the other company's scope via a query parameter.
        $data = $this->auth()->getJson(self::BASE."/executive?company_id={$other->id}")
            ->assertOk()
            ->json('data');

        // Still our (empty) company — the parameter did nothing.
        $this->assertSame(0, $data['headline']['fieldable_units']);
    }

    // ═══ ACCESS CONTROL ══════════════════════════════════════════════════════

    public function test_the_dashboards_require_authentication(): void
    {
        $this->getJson(self::BASE.'/executive')->assertUnauthorized();
        $this->getJson(self::BASE.'/operations')->assertUnauthorized();
    }

    public function test_a_user_without_the_permission_is_refused(): void
    {
        $stranger = User::factory()->create(['company_id' => $this->company->id]);
        $role = Role::create([
            'name' => 'Completion Nobody',
            'slug' => 'completion-nobody-'.$this->suffix(),
            'is_system' => false,
        ]);
        $stranger->roles()->attach($role->id);

        $this->actingAs($stranger)->getJson(self::BASE.'/executive')->assertForbidden();
    }

    public function test_it_reuses_operations_view_and_mints_no_new_permission(): void
    {
        $viewer = User::factory()->create(['company_id' => $this->company->id]);
        $role = Role::create([
            'name' => 'Completion Viewer',
            'slug' => 'completion-viewer-'.$this->suffix(),
            'is_system' => false,
        ]);
        $role->permissions()->attach(Permission::where('name', 'operations.view')->value('id'));
        $viewer->roles()->attach($role->id);

        $this->actingAs($viewer)->getJson(self::BASE.'/executive')->assertOk();
        $this->actingAs($viewer)->getJson(self::BASE.'/operations')->assertOk();

        $this->assertNull(Permission::where('name', 'like', 'enterprise.%')->first());
    }

    // ═══ ADDITIVITY ══════════════════════════════════════════════════════════

    public function test_the_whole_v2_surface_still_answers(): void
    {
        $this->auth()->getJson('/api/logistics/dispatch/options')->assertOk();
        $this->auth()->getJson('/api/logistics/operations/health/overview')->assertOk();
        $this->auth()->getJson('/api/logistics/operations/readiness')->assertOk();
        $this->auth()->getJson('/api/logistics/intelligence/decisions')->assertOk();
        $this->auth()->getJson('/api/logistics/automation/monitoring')->assertOk();
    }
}
