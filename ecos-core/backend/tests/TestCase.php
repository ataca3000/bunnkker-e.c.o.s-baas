<?php

declare(strict_types=1);

namespace Tests;

use App\Models\User;
use Illuminate\Contracts\Auth\Authenticatable as UserContract;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Env;
use Modules\IAM\Domain\Models\Role;
use ReflectionProperty;

abstract class TestCase extends BaseTestCase
{
    /**
     * Whether actingAs() grants a baseline system role to role-less users.
     *
     * Tests that exercise the authorization system itself must set this to false,
     * otherwise their subjects would be granted the very access they assert is
     * denied. Every other test wants it: 501 route registrations carry
     * `permission:` middleware, and a user created by User::factory() holds no
     * roles, so the request is rejected with 403 before the code under test runs.
     */
    protected bool $grantsBaselineAuthorization = true;

    protected function setUp(): void
    {
        // Override all three env sources BEFORE parent::setUp() creates the Laravel app.
        // Docker env_file bakes DB_DATABASE=ecos_erp into OS env at container start.
        // PHPUnit's force="true" only calls putenv(); Laravel's immutable Dotenv reads
        // $_ENV first (the Docker value) so putenv() alone has no effect.
        putenv('DB_DATABASE=ecos_erp_test');
        $_ENV['DB_DATABASE'] = 'ecos_erp_test';
        $_SERVER['DB_DATABASE'] = 'ecos_erp_test';

        // Reset the static Env repository singleton so it re-reads from the updated vars
        // when the next app instance reads env('DB_DATABASE').
        $prop = new ReflectionProperty(Env::class, 'repository');
        $prop->setValue(null, null);

        parent::setUp();
    }

    /**
     * Authenticate as $user, granting the production system role when the user
     * holds no roles at all.
     *
     * This is not an authorization bypass. It uses the same objects production
     * uses — the Role model, the user_roles pivot, and the is_system flag that
     * RequirePermissionMiddleware consults via PermissionService::userHasSystemRole().
     * Middleware still runs, policies still run, and a user who already carries a
     * role is left exactly as the test built them, so tests that deliberately
     * construct a restricted subject keep asserting denial.
     */
    public function actingAs(UserContract $user, $guard = null)
    {
        if ($this->grantsBaselineAuthorization
            && $user instanceof User
            // An unpersisted user (User::factory()->make()) has no primary key, so
            // it cannot hold roles — attaching one would insert a null user_id.
            // Tests that only need an authenticated identity use make() deliberately.
            && $user->exists
            && ! $user->roles()->exists()
        ) {
            $this->grantSystemRole($user);
        }

        return parent::actingAs($user, $guard);
    }

    /**
     * Authenticate WITHOUT the baseline system role.
     *
     * For cases that assert authorization denial. actingAs() grants the system
     * role to a role-less user, which is right for the vast majority of tests but
     * would hand a deliberately unprivileged subject the very access the case
     * asserts is refused. Using this method states that intent explicitly instead
     * of relying on the absence of roles, which is indistinguishable from a
     * fixture that simply forgot to assign one.
     */
    protected function actingAsUnprivileged(UserContract $user, $guard = null): static
    {
        parent::actingAs($user, $guard);

        return $this;
    }

    /**
     * Attach the role that config/permissions.php marks is_system.
     *
     * The slug is read from configuration rather than hardcoded, matching the
     * middleware's own rule: "any role with is_system = true passes
     * unconditionally, regardless of slug. Never hardcode role names here."
     */
    protected function grantSystemRole(User $user): User
    {
        $slug = null;
        $definition = null;

        foreach ((array) config('permissions.roles', []) as $candidate => $def) {
            if (! empty($def['is_system'])) {
                $slug = $candidate;
                $definition = $def;
                break;
            }
        }

        if ($slug === null) {
            return $user;
        }

        $role = Role::firstOrCreate(
            ['slug' => $slug],
            ['name' => $definition['name'] ?? $slug, 'is_system' => true],
        );

        $user->roles()->attach($role->id);
        $user->unsetRelation('roles');

        return $user;
    }
}
