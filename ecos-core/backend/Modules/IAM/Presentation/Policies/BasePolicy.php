<?php

declare(strict_types=1);

namespace Modules\IAM\Presentation\Policies;

use App\Models\User;
use Modules\IAM\Domain\Contracts\PermissionServiceInterface;

/**
 * Abstract base for all ECOS ERP policies.
 *
 * Extend this class to create a module policy.  The PermissionService is
 * injected by the container so policies stay framework-agnostic.
 *
 * Example:
 *   class ProductPolicy extends BasePolicy
 *   {
 *       public function view(User $user): bool
 *       {
 *           return $this->can($user, 'products.view');
 *       }
 *   }
 *
 * Register in IamServiceProvider::boot():
 *   Gate::policy(Product::class, ProductPolicy::class);
 *
 * Super-Admin bypass is handled globally in Gate::before() — individual
 * policies do NOT need to re-check that role.
 */
abstract class BasePolicy
{
    public function __construct(
        protected readonly PermissionServiceInterface $permissions,
    ) {}

    /**
     * Shorthand: check a permission name against the permission service.
     */
    protected function can(User $user, string $permission): bool
    {
        return $this->permissions->userHasPermission($user, $permission);
    }
}
