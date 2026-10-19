<?php

declare(strict_types=1);

namespace Modules\IAM\Infrastructure\Providers;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Modules\IAM\Application\Commands\ResetDevAdminCommand;
use Modules\IAM\Application\Services\AuthorizationGateway;
use Modules\IAM\Application\Services\PermissionRegistry;
use Modules\IAM\Application\Services\PermissionService;
use Modules\IAM\Application\Services\PermissionExpander;
use Modules\IAM\Application\Services\PolicyResolver;
use Modules\IAM\Application\Services\RoleCompositionService;
use Modules\IAM\Application\Services\RoleTemplateRepository;
use Modules\IAM\Application\Services\ScopeResolver;
use Modules\IAM\Application\Services\SensitiveFieldRegistry;
use Modules\IAM\Application\Services\VisibilityResolver;
use Modules\IAM\Domain\Contracts\AuthorizationGatewayInterface;
use Modules\IAM\Domain\Contracts\AuthServiceInterface;
use Modules\IAM\Domain\Contracts\PermissionRegistryInterface;
use Modules\IAM\Domain\Contracts\PermissionServiceInterface;
use Modules\IAM\Domain\Contracts\PolicyResolverInterface;
use Modules\IAM\Domain\Contracts\RoleCompositionInterface;
use Modules\IAM\Domain\Contracts\RoleTemplateRepositoryInterface;
use Modules\IAM\Domain\Contracts\ScopeResolverInterface;
use Modules\IAM\Domain\Contracts\SensitiveFieldRegistryInterface;
use Modules\IAM\Domain\Contracts\VisibilityResolverInterface;
use Modules\IAM\Infrastructure\Middleware\RequirePermissionMiddleware;
use Modules\IAM\Infrastructure\Services\SanctumAuthService;
use Modules\IAM\Presentation\Policies\UserPolicy;

/**
 * IAM module service provider.
 *
 * Responsibilities:
 *  1. Bind auth + permission service ports to their implementations.
 *  2. Load RBAC migrations.
 *  3. Register the `permission:` route middleware alias.
 *  4. Wire Gate::before() so system roles bypass all ability checks.
 *     The bypass is keyed on is_system = true — never on a hardcoded slug.
 */
final class IamServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(AuthServiceInterface::class, SanctumAuthService::class);

        $this->app->bind(PermissionServiceInterface::class, PermissionService::class);

        // ── Enterprise Authorization Platform (TASK-IAM-002 / ADR-038) ────────────
        // The Gateway is the single public entry point; it composes the four engines
        // below. The Authorization engine (PermissionService) is unchanged — the Gateway
        // delegates can()/authorize() to it, so runtime behaviour is identical.
        $this->app->bind(AuthorizationGatewayInterface::class, AuthorizationGateway::class);

        // Registries are singletons so a module registers its permissions / sensitive
        // fields / policy rules once per request.
        $this->app->singleton(PermissionRegistryInterface::class, PermissionRegistry::class);
        $this->app->singleton(SensitiveFieldRegistryInterface::class, SensitiveFieldRegistry::class);

        // The Visibility, Data Scope, and Policy engines.
        $this->app->singleton(VisibilityResolverInterface::class, VisibilityResolver::class);
        $this->app->singleton(ScopeResolverInterface::class, ScopeResolver::class);
        $this->app->singleton(PolicyResolverInterface::class, PolicyResolver::class);

        // ── Enterprise Role Templates (TASK-IAM-003 / ADR-039) ────────────────────
        // The business job-profile layer. Templates author; roles execute — the
        // authorization runtime above is untouched.
        $this->app->bind(RoleTemplateRepositoryInterface::class, RoleTemplateRepository::class);
        $this->app->bind(RoleCompositionInterface::class, RoleCompositionService::class);
        $this->app->singleton(PermissionExpander::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');

        if ($this->app->runningInConsole()) {
            $this->commands([ResetDevAdminCommand::class]);
        }

        $this->app['router']->aliasMiddleware('permission', RequirePermissionMiddleware::class);

        // Enterprise User Management Platform authorization (TASK-IAM-004 / ADR-040).
        Gate::policy(User::class, UserPolicy::class);

        // Data Scope Engine query macro (ADR-038, Part 3). Modules narrow a query to the
        // caller's data scope with `Model::query()->scopedTo($user, 'sales.orders')`
        // instead of hand-writing WHERE clauses. Opt-in — unscoped queries are unchanged.
        Builder::macro('scopedTo', function (User $user, string $resource, ?string $ownerColumn = null) {
            /** @var Builder $this */
            $constraint = app(ScopeResolverInterface::class)->resolve($user, $resource, $ownerColumn);

            return $constraint->applyTo($this);
        });

        // System role gate bypass: any role with is_system = true skips all
        // subsequent policy / ability checks. This covers Super Admin today and
        // any future system roles (Owner, Support, etc.) without code changes.
        Gate::before(function (User $user, string $ability): ?bool {
            /** @var PermissionServiceInterface $permissions */
            $permissions = $this->app->make(PermissionServiceInterface::class);

            if ($permissions->userHasSystemRole($user)) {
                return true;
            }

            return null;
        });
    }
}
