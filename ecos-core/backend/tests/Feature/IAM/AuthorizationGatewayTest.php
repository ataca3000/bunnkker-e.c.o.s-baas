<?php

declare(strict_types=1);

namespace Tests\Feature\IAM;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\IAM\Application\Services\AuthorizationGateway;
use Modules\IAM\Domain\Contracts\AuthorizationGatewayInterface;
use Modules\IAM\Domain\Contracts\PermissionServiceInterface;
use Modules\IAM\Domain\Models\Permission;
use Modules\IAM\Domain\Models\Role;
use Modules\IAM\Domain\ValueObjects\AuthorizationDecision;
use Modules\IAM\Domain\ValueObjects\PermissionName;
use Tests\TestCase;

/**
 * TASK-IAM-002 Phase 1 — AuthorizationGateway.
 *
 * Proves the gateway is the entry point AND that it delegates byte-for-byte to the
 * existing PermissionService, so no authorization behaviour changes.
 */
class AuthorizationGatewayTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    private function role(string $slug, bool $isSystem = false): Role
    {
        return Role::create(['name' => ucfirst($slug), 'slug' => $slug, 'is_system' => $isSystem]);
    }

    private function perm(string $name): Permission
    {
        [$domain, $resource, $action] = explode('.', $name);

        return Permission::create(['name' => $name, 'module' => $domain, 'resource' => $resource, 'action' => $action]);
    }

    private function grant(string $roleSlug, string $permission): void
    {
        $role = $this->role($roleSlug);
        $perm = $this->perm($permission);
        $role->permissions()->attach($perm->id);
        $this->user->roles()->attach($role->id);
    }

    private function gateway(): AuthorizationGatewayInterface
    {
        return app(AuthorizationGatewayInterface::class);
    }

    public function test_gateway_resolves_from_container(): void
    {
        $this->assertInstanceOf(AuthorizationGateway::class, $this->gateway());
    }

    public function test_can_returns_true_for_granted_permission(): void
    {
        $this->grant('editor', 'inventory.products.create');

        $this->assertTrue($this->gateway()->can($this->user, 'inventory.products.create'));
    }

    public function test_can_returns_false_for_missing_permission(): void
    {
        $this->grant('reader', 'inventory.products.view');

        $this->assertFalse($this->gateway()->can($this->user, 'inventory.products.delete'));
    }

    public function test_can_is_byte_for_byte_identical_to_permission_service(): void
    {
        $this->grant('sales', 'sales.orders.view');

        $service = app(PermissionServiceInterface::class);
        $gateway = $this->gateway();

        foreach (['sales.orders.view', 'sales.orders.delete', 'inventory.products.view'] as $permission) {
            $this->assertSame(
                $service->userHasPermission($this->user, $permission),
                $gateway->can($this->user, $permission),
                "Gateway diverged from PermissionService for {$permission}",
            );
        }
    }

    public function test_cannot_is_the_inverse_of_can(): void
    {
        $this->grant('editor', 'inventory.products.create');

        $this->assertFalse($this->gateway()->cannot($this->user, 'inventory.products.create'));
        $this->assertTrue($this->gateway()->cannot($this->user, 'inventory.products.delete'));
    }

    public function test_inspect_returns_allow_decision(): void
    {
        $this->grant('editor', 'inventory.products.update');

        $decision = $this->gateway()->inspect($this->user, 'inventory.products.update');

        $this->assertInstanceOf(AuthorizationDecision::class, $decision);
        $this->assertTrue($decision->isAllowed());
        $this->assertSame('inventory.products.update', $decision->matchedPermission);
        // inspect() is authorization-only: it does not compose visibility/scope.
        $this->assertNull($decision->hiddenFields);
        $this->assertNull($decision->matchedScope);
    }

    public function test_inspect_returns_deny_decision(): void
    {
        $decision = $this->gateway()->inspect($this->user, 'inventory.products.delete');

        $this->assertTrue($decision->isDenied());
        $this->assertNull($decision->matchedPermission);
        $this->assertNotSame('', $decision->reason());
    }

    public function test_system_role_is_allowed_via_bypass_reason(): void
    {
        $role = $this->role('super-admin', isSystem: true);
        $this->user->roles()->attach($role->id);

        $decision = $this->gateway()->inspect($this->user, 'finance.periods.close');

        $this->assertTrue($decision->isAllowed());
        $this->assertSame('system role bypass', $decision->reason());
    }

    public function test_can_accepts_permission_name_value_object(): void
    {
        $this->grant('editor', 'inventory.products.view_cost');

        $this->assertTrue(
            $this->gateway()->can($this->user, PermissionName::from('Inventory.Products.ViewCost')),
        );
    }

    public function test_decide_is_an_alias_of_decision(): void
    {
        $this->grant('editor', 'inventory.products.update');

        $decide = $this->gateway()->decide($this->user, 'inventory.products.update');
        $decision = $this->gateway()->decision($this->user, 'inventory.products.update');

        // decide() delegates to decision(): same allow/scope/fields (ignoring the timestamp).
        $this->assertSame($decision->isAllowed(), $decide->isAllowed());
        $this->assertSame($decision->matchedScope, $decide->matchedScope);
        $this->assertSame($decision->hiddenFields, $decide->hiddenFields);
    }
}
