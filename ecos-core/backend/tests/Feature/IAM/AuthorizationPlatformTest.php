<?php

declare(strict_types=1);

namespace Tests\Feature\IAM;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Modules\IAM\Domain\Contracts\AuthorizationGatewayInterface;
use Modules\IAM\Domain\Contracts\PolicyResolverInterface;
use Modules\IAM\Domain\Contracts\ScopeResolverInterface;
use Modules\IAM\Domain\Contracts\SensitiveFieldRegistryInterface;
use Modules\IAM\Domain\Contracts\VisibilityResolverInterface;
use Modules\IAM\Domain\Enums\FieldVisibility;
use Modules\IAM\Domain\Models\Permission;
use Modules\IAM\Domain\Models\Role;
use Modules\IAM\Domain\Policies\PolicyContext;
use Modules\IAM\Domain\Policies\PolicyResult;
use Modules\IAM\Domain\Policies\PolicyRule;
use Tests\TestCase;

/**
 * TASK-IAM-002 — Enterprise Authorization Platform: Visibility, Data Scope, Policy
 * engines + Gateway composition.
 */
class AuthorizationPlatformTest extends TestCase
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
        [$d, $r, $a] = explode('.', $name);

        // firstOrCreate: the same permission may be granted to more than one role.
        return Permission::firstOrCreate(
            ['name' => $name],
            ['module' => $d, 'resource' => $r, 'action' => $a],
        );
    }

    private function grant(string $roleSlug, string $permission, ?string $dataScope = null): Role
    {
        $role = $this->role($roleSlug);
        $perm = $this->perm($permission);
        $role->permissions()->attach($perm->id);
        $this->user->roles()->attach($role->id);

        if ($dataScope !== null) {
            DB::table('role_permissions')
                ->where('role_id', $role->id)
                ->where('permission_id', $perm->id)
                ->update(['data_scope' => $dataScope]);
        }

        return $role;
    }

    // ── Visibility Engine ─────────────────────────────────────────────────────

    public function test_sensitive_field_is_hidden_without_permission(): void
    {
        app(SensitiveFieldRegistryInterface::class)->register('inventory.products', [
            'average_cost' => 'inventory.products.view_cost',
            'margin' => 'inventory.products.view_margin',
        ]);
        $this->grant('clerk', 'inventory.products.view'); // can open the screen, no cost/margin

        $visibility = app(VisibilityResolverInterface::class);

        $this->assertSame(FieldVisibility::HIDDEN, $visibility->fieldState($this->user, 'inventory.products', 'average_cost'));
        $this->assertContains('average_cost', $visibility->hiddenFields($this->user, 'inventory.products'));
        $this->assertContains('margin', $visibility->hiddenFields($this->user, 'inventory.products'));
        // A non-sensitive field is always visible.
        $this->assertSame(FieldVisibility::VISIBLE, $visibility->fieldState($this->user, 'inventory.products', 'name'));
    }

    public function test_sensitive_field_is_visible_with_permission(): void
    {
        app(SensitiveFieldRegistryInterface::class)->register('inventory.products', [
            'average_cost' => 'inventory.products.view_cost',
        ]);
        $this->grant('manager', 'inventory.products.view');
        $this->grant('coster', 'inventory.products.view_cost');

        $visibility = app(VisibilityResolverInterface::class);

        $this->assertSame(FieldVisibility::VISIBLE, $visibility->fieldState($this->user, 'inventory.products', 'average_cost'));
        $this->assertSame([], $visibility->hiddenFields($this->user, 'inventory.products'));
    }

    public function test_system_role_hides_nothing(): void
    {
        app(SensitiveFieldRegistryInterface::class)->register('inventory.products', [
            'average_cost' => 'inventory.products.view_cost',
        ]);
        $role = $this->role('super-admin', isSystem: true);
        $this->user->roles()->attach($role->id);

        $this->assertSame([], app(VisibilityResolverInterface::class)->hiddenFields($this->user, 'inventory.products'));
    }

    // ── Data Scope Engine ─────────────────────────────────────────────────────

    public function test_default_scope_is_unrestricted(): void
    {
        $this->grant('viewer', 'sales.orders.view'); // data_scope defaults to 'all'

        $constraint = app(ScopeResolverInterface::class)->resolve($this->user, 'sales.orders');

        $this->assertTrue($constraint->isUnrestricted());
    }

    public function test_self_scope_constrains_to_owner(): void
    {
        $this->grant('rep', 'sales.orders.view', dataScope: 'self');

        $constraint = app(ScopeResolverInterface::class)->resolve($this->user, 'sales.orders', 'sales_user_id');

        $this->assertFalse($constraint->isUnrestricted());
        $this->assertSame('sales_user_id', $constraint->column);
        $this->assertSame([$this->user->getKey()], $constraint->values);
    }

    public function test_widest_scope_wins_across_roles(): void
    {
        $this->grant('rep', 'sales.orders.view', dataScope: 'self');
        $this->grant('manager', 'sales.orders.view', dataScope: 'all');

        $this->assertTrue(app(ScopeResolverInterface::class)->resolve($this->user, 'sales.orders')->isUnrestricted());
    }

    public function test_scoped_to_query_macro_is_registered(): void
    {
        $this->grant('viewer', 'sales.orders.view');

        // Macro exists and returns a builder; ALL scope leaves the query unrestricted.
        $query = Permission::query()->scopedTo($this->user, 'sales.orders');
        $this->assertNotEmpty($query->toSql());
    }

    // ── Policy Engine ─────────────────────────────────────────────────────────

    public function test_policy_engine_denies_when_a_rule_objects(): void
    {
        $resolver = app(PolicyResolverInterface::class);
        $resolver->registerRule($this->windowRule());

        $open = $resolver->evaluate($this->user, 'commerce.orders.cancel', null, ['within_window' => true]);
        $late = $resolver->evaluate($this->user, 'commerce.orders.cancel', null, ['within_window' => false]);

        $this->assertTrue($open->isAllowed());
        $this->assertTrue($late->isDenied());
        $this->assertSame('order.cancellation-window', $late->rule);
    }

    public function test_policy_allows_when_no_rule_applies(): void
    {
        $resolver = app(PolicyResolverInterface::class);
        $resolver->registerRule($this->windowRule());

        $this->assertTrue($resolver->evaluate($this->user, 'inventory.products.delete')->isAllowed());
        $this->assertFalse($resolver->hasRulesFor('inventory.products.delete'));
    }

    // ── Gateway composition ───────────────────────────────────────────────────

    public function test_decision_composes_visibility_and_scope(): void
    {
        app(SensitiveFieldRegistryInterface::class)->register('inventory.products', [
            'average_cost' => 'inventory.products.view_cost',
        ]);
        $this->grant('clerk', 'inventory.products.view', dataScope: 'company');

        $decision = app(AuthorizationGatewayInterface::class)->decision($this->user, 'inventory.products.view');

        $this->assertTrue($decision->isAllowed());
        $this->assertContains('average_cost', (array) $decision->hiddenFields);
        $this->assertSame('company', $decision->matchedScope);
    }

    public function test_decision_is_vetoed_by_policy(): void
    {
        app(PolicyResolverInterface::class)->registerRule($this->windowRule());
        $this->grant('rep', 'commerce.orders.cancel');

        // Authorized, but the business rule denies (outside the window is the default here).
        $decision = app(AuthorizationGatewayInterface::class)
            ->decision($this->user, 'commerce.orders.cancel');

        $this->assertTrue($decision->isDenied());
        $this->assertSame('policy', $decision->source);
        $this->assertSame('order.cancellation-window', $decision->matchedPolicy);
    }

    public function test_authorize_throws_when_denied(): void
    {
        $this->expectException(\Illuminate\Auth\Access\AuthorizationException::class);
        app(AuthorizationGatewayInterface::class)->authorize($this->user, 'finance.periods.close');
    }

    private function windowRule(): PolicyRule
    {
        return new class implements PolicyRule
        {
            public function key(): string
            {
                return 'order.cancellation-window';
            }

            public function appliesTo(string $action): bool
            {
                return $action === 'commerce.orders.cancel';
            }

            public function evaluate(PolicyContext $context): PolicyResult
            {
                return $context->attribute('within_window', false) === true
                    ? PolicyResult::allow('inside window')
                    : PolicyResult::deny('cancellation window has closed', $this->key());
            }
        };
    }
}
