<?php

declare(strict_types=1);

namespace Tests\Feature\IAM;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;
use Modules\IAM\Application\Services\PermissionService;
use Modules\IAM\Domain\Contracts\PermissionServiceInterface;
use Modules\IAM\Domain\Models\Permission;
use Modules\IAM\Domain\Models\Role;
use Tests\TestCase;

/**
 * TASK-SECURITY-001A — Enterprise RBAC Upgrade
 *
 * All permissions use the three-segment convention: domain.resource.action
 * All pivot table assertions use the new entity table names: user_roles, role_permissions
 *
 * Verifies:
 *  1.  Role can be created and retrieved by slug
 *  2.  Permission can be created with domain.resource.action name
 *  3.  Permission can be assigned to a role (role_permissions table)
 *  4.  Role can be assigned to a user (user_roles table)
 *  5.  userHasPermission returns true for granted permission
 *  6.  userHasPermission returns false for missing permission
 *  7.  userHasRole returns true for assigned role
 *  8.  userHasRole returns false for unassigned role
 *  9.  roleHasPermission returns true for direct grant
 *  10. roleHasPermission returns false when not granted
 *  11. permission: middleware allows request with valid permission
 *  12. permission: middleware returns 403 when permission missing
 *  13. permission: middleware returns 401 when unauthenticated
 *  14. User permissions are cached on first lookup
 *  15. invalidateUserCache removes cached permissions
 *  16. invalidateRoleCache clears cache for all role members
 *  17. System role passes middleware without explicit permission
 *  18. System role bypasses Gate::allows()
 *  19. PermissionService resolves from the container
 *  20. getUserPermissions merges permissions across multiple roles
 *  21. Non-system role does NOT get middleware bypass
 *  22. userHasSystemRole returns false when user has no system role
 *  23. userHasPermissionInScope delegates to flat check (stub)
 */
class RbacTest extends TestCase
{
    use RefreshDatabase;

    /**
     * This suite is the authorization system's own test. Its subjects must carry
     * exactly the roles each case assigns — a baseline system role would hand them
     * the access they assert is denied.
     */
    protected bool $grantsBaselineAuthorization = false;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function role(string $slug, string $name = 'Test Role', bool $isSystem = false): Role
    {
        return Role::create(['name' => $name, 'slug' => $slug, 'is_system' => $isSystem]);
    }

    /** Three-segment permission: domain.resource.action */
    private function perm(string $name): Permission
    {
        [$domain, $resource, $action] = explode('.', $name);

        return Permission::create([
            'name' => $name,
            'module' => $domain,
            'resource' => $resource,
            'action' => $action,
        ]);
    }

    private function service(): PermissionServiceInterface
    {
        return app(PermissionServiceInterface::class);
    }

    // ── 1–2: Basic model creation ─────────────────────────────────────────────

    public function test_role_can_be_created_and_retrieved_by_slug(): void
    {
        $role = $this->role('warehouse-manager', 'Warehouse Manager');

        $this->assertDatabaseHas('roles', [
            'slug' => 'warehouse-manager',
            'name' => 'Warehouse Manager',
        ]);

        $found = Role::where('slug', 'warehouse-manager')->first();
        $this->assertNotNull($found);
        $this->assertSame($role->id, $found->id);
    }

    public function test_permission_can_be_created_with_hierarchical_name(): void
    {
        $perm = $this->perm('inventory.products.view');

        $this->assertDatabaseHas('permissions', [
            'name' => 'inventory.products.view',
            'module' => 'inventory',
            'resource' => 'products',
            'action' => 'view',
        ]);
        $this->assertNotEmpty($perm->id);
    }

    // ── 3–4: Relationship assignment ──────────────────────────────────────────

    public function test_permission_can_be_assigned_to_role(): void
    {
        $role = $this->role('sales');
        $perm = $this->perm('sales.orders.view');

        $role->permissions()->attach($perm->id);

        $this->assertDatabaseHas('role_permissions', [
            'role_id' => $role->id,
            'permission_id' => $perm->id,
        ]);
    }

    public function test_role_can_be_assigned_to_user(): void
    {
        $role = $this->role('viewer');

        $this->user->roles()->attach($role->id);

        $this->assertDatabaseHas('user_roles', [
            'user_id' => $this->user->id,
            'role_id' => $role->id,
        ]);
    }

    // ── 5–6: userHasPermission ────────────────────────────────────────────────

    public function test_user_has_permission_returns_true_for_granted_permission(): void
    {
        $role = $this->role('editor');
        $perm = $this->perm('inventory.products.create');
        $role->permissions()->attach($perm->id);
        $this->user->roles()->attach($role->id);

        $this->assertTrue($this->service()->userHasPermission($this->user, 'inventory.products.create'));
    }

    public function test_user_has_permission_returns_false_for_missing_permission(): void
    {
        $role = $this->role('reader');
        $perm = $this->perm('inventory.products.view');
        $role->permissions()->attach($perm->id);
        $this->user->roles()->attach($role->id);

        $this->assertFalse($this->service()->userHasPermission($this->user, 'inventory.products.delete'));
    }

    // ── 7–8: userHasRole ─────────────────────────────────────────────────────

    public function test_user_has_role_returns_true_for_assigned_role(): void
    {
        $role = $this->role('purchasing');
        $this->user->roles()->attach($role->id);

        $this->assertTrue($this->service()->userHasRole($this->user, 'purchasing'));
    }

    public function test_user_has_role_returns_false_for_unassigned_role(): void
    {
        $this->role('purchasing');

        $this->assertFalse($this->service()->userHasRole($this->user, 'purchasing'));
    }

    // ── 9–10: roleHasPermission ───────────────────────────────────────────────

    public function test_role_has_permission_returns_true_for_direct_grant(): void
    {
        $role = $this->role('ops');
        $perm = $this->perm('sales.orders.fulfill');
        $role->permissions()->attach($perm->id);

        $this->assertTrue($this->service()->roleHasPermission($role, 'sales.orders.fulfill'));
    }

    public function test_role_has_permission_returns_false_when_not_granted(): void
    {
        $role = $this->role('ops');
        $this->perm('sales.orders.fulfill');

        $this->assertFalse($this->service()->roleHasPermission($role, 'sales.orders.fulfill'));
    }

    // ── 11–13: permission: middleware ─────────────────────────────────────────

    public function test_middleware_allows_request_when_user_has_permission(): void
    {
        $role = $this->role('staff');
        $perm = $this->perm('inventory.categories.view');
        $role->permissions()->attach($perm->id);
        $this->user->roles()->attach($role->id);

        \Illuminate\Support\Facades\Route::middleware('permission:inventory.categories.view')
            ->get('/test-rbac/categories', fn () => response()->json(['ok' => true]));

        $this->actingAs($this->user)
            ->getJson('/test-rbac/categories')
            ->assertOk()
            ->assertJsonPath('ok', true);
    }

    public function test_middleware_returns_403_when_permission_missing(): void
    {
        $this->role('viewer');

        \Illuminate\Support\Facades\Route::middleware('permission:inventory.products.delete')
            ->get('/test-rbac/products-delete', fn () => response()->json(['ok' => true]));

        $this->actingAs($this->user)
            ->getJson('/test-rbac/products-delete')
            ->assertForbidden();
    }

    public function test_middleware_returns_401_when_unauthenticated(): void
    {
        \Illuminate\Support\Facades\Route::middleware('permission:sales.orders.view')
            ->get('/test-rbac/orders', fn () => response()->json(['ok' => true]));

        $this->getJson('/test-rbac/orders')
            ->assertUnauthorized();
    }

    // ── 14–16: Cache behaviour ────────────────────────────────────────────────

    public function test_user_permissions_are_cached_on_first_lookup(): void
    {
        $role = $this->role('cacher');
        $perm = $this->perm('sales.channels.sync');
        $role->permissions()->attach($perm->id);
        $this->user->roles()->attach($role->id);

        $cacheKey = "rbac.user.{$this->user->id}.perms";
        Cache::forget($cacheKey);

        $this->assertNull(Cache::get($cacheKey));

        $this->service()->getUserPermissions($this->user);

        $this->assertNotNull(Cache::get($cacheKey));
        $this->assertContains('sales.channels.sync', Cache::get($cacheKey));
    }

    public function test_invalidate_user_cache_removes_cached_permissions(): void
    {
        $role = $this->role('cache-test-role');
        $perm = $this->perm('inventory.warehouses.view');
        $role->permissions()->attach($perm->id);
        $this->user->roles()->attach($role->id);

        $this->service()->getUserPermissions($this->user);
        $cacheKey = "rbac.user.{$this->user->id}.perms";
        $this->assertNotNull(Cache::get($cacheKey));

        $this->service()->invalidateUserCache($this->user->id);

        $this->assertNull(Cache::get($cacheKey));
    }

    public function test_invalidate_role_cache_clears_cache_for_all_role_members(): void
    {
        $role = $this->role('shared-role');
        $perm = $this->perm('purchasing.suppliers.view');
        $role->permissions()->attach($perm->id);

        $user2 = User::factory()->create();
        $this->user->roles()->attach($role->id);
        $user2->roles()->attach($role->id);

        $this->service()->getUserPermissions($this->user);
        $this->service()->getUserPermissions($user2);

        $this->service()->invalidateRoleCache($role);

        $this->assertNull(Cache::get("rbac.user.{$this->user->id}.perms"));
        $this->assertNull(Cache::get("rbac.user.{$user2->id}.perms"));
    }

    // ── 17–18: System role bypass (is_system = true) ─────────────────────────

    public function test_system_role_passes_permission_middleware_without_explicit_permission(): void
    {
        $systemRole = $this->role('super-admin', 'Super Admin', isSystem: true);
        $this->user->roles()->attach($systemRole->id);

        \Illuminate\Support\Facades\Route::middleware('permission:iam.roles.delete')
            ->get('/test-rbac/super', fn () => response()->json(['ok' => true]));

        $this->actingAs($this->user)
            ->getJson('/test-rbac/super')
            ->assertOk();
    }

    public function test_system_role_bypasses_gate_allows(): void
    {
        $systemRole = $this->role('super-admin', 'Super Admin', isSystem: true);
        $this->user->roles()->attach($systemRole->id);

        $this->actingAs($this->user);
        $this->assertTrue(Gate::allows('any.ability.that.does.not.exist'));
    }

    // ── 19: Container resolution ──────────────────────────────────────────────

    public function test_permission_service_resolves_from_container(): void
    {
        $service = app(PermissionServiceInterface::class);

        $this->assertInstanceOf(PermissionService::class, $service);
    }

    // ── 20: Multi-role merge ──────────────────────────────────────────────────

    public function test_get_user_permissions_merges_across_multiple_roles(): void
    {
        $roleA = $this->role('role-a');
        $roleB = $this->role('role-b');

        $roleA->permissions()->attach($this->perm('inventory.units.view')->id);
        $roleB->permissions()->attach($this->perm('inventory.units.create')->id);

        $this->user->roles()->attach([$roleA->id, $roleB->id]);

        $perms = $this->service()->getUserPermissions($this->user);

        $this->assertContains('inventory.units.view', $perms);
        $this->assertContains('inventory.units.create', $perms);
    }

    // ── 21: Non-system role does not bypass ───────────────────────────────────

    public function test_non_system_role_does_not_bypass_permission_middleware(): void
    {
        $regularRole = $this->role('company-admin', 'Company Admin', isSystem: false);
        $this->user->roles()->attach($regularRole->id);

        \Illuminate\Support\Facades\Route::middleware('permission:iam.roles.delete')
            ->get('/test-rbac/non-system', fn () => response()->json(['ok' => true]));

        $this->actingAs($this->user)
            ->getJson('/test-rbac/non-system')
            ->assertForbidden();
    }

    // ── 22: userHasSystemRole ─────────────────────────────────────────────────

    public function test_user_has_system_role_returns_false_when_no_system_role(): void
    {
        $regularRole = $this->role('viewer', 'Viewer', isSystem: false);
        $this->user->roles()->attach($regularRole->id);

        $this->assertFalse($this->service()->userHasSystemRole($this->user));
    }

    public function test_user_has_system_role_returns_true_for_any_system_role(): void
    {
        // A hypothetical future system role — bypass must work regardless of slug
        $futureSystemRole = $this->role('owner', 'Owner', isSystem: true);
        $this->user->roles()->attach($futureSystemRole->id);

        $this->assertTrue($this->service()->userHasSystemRole($this->user));
    }

    // ── 23: userHasPermissionInScope (stub) ───────────────────────────────────

    public function test_user_has_permission_in_scope_delegates_to_flat_check(): void
    {
        $role = $this->role('scoped-role');
        $perm = $this->perm('inventory.stock.adjust');
        $role->permissions()->attach($perm->id);
        $this->user->roles()->attach($role->id);

        // Scope params are ignored in the current stub — flat check applies.
        $this->assertTrue(
            $this->service()->userHasPermissionInScope(
                $this->user,
                'inventory.stock.adjust',
                companyId: 'some-company-uuid',
                branchId: null,
                warehouseId: null,
            ),
        );
    }
}
