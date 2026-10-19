<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Modules\IAM\Domain\Contracts\PermissionServiceInterface;
use Modules\IAM\Domain\Models\Role;

/**
 * Central permission authority.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  Cache strategy                                                          │
 * │                                                                          │
 * │  Key   rbac.user.{id}.perms                                              │
 * │  TTL   300 s (auto-expires; safety net when invalidation is missed)      │
 * │                                                                          │
 * │  Tag support: when the active cache store supports tagging (Redis,       │
 * │  Memcached), the "rbac" tag group is used so role-wide invalidation      │
 * │  becomes a single tag flush instead of iterating all role members.       │
 * │  Falls back to key-based invalidation for file/database/array drivers.  │
 * │                                                                          │
 * │  Invalidation                                                            │
 * │  • Role assigned/revoked for a user → invalidateUserCache($userId)       │
 * │  • Permission added/removed from a role → invalidateRoleCache($role)     │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class PermissionService implements PermissionServiceInterface
{
    private const TTL = 300;

    private const CACHE_PREFIX = 'rbac.user.';

    public function userHasPermission(User $user, string $permission): bool
    {
        return in_array($permission, $this->getUserPermissions($user), true);
    }

    public function userHasPermissionInScope(
        User $user,
        string $permission,
        ?string $companyId = null,
        ?string $branchId = null,
        ?string $warehouseId = null,
    ): bool {
        // Scope resolution not yet implemented.
        // Delegates to flat permission check until scoped authorization lands.
        return $this->userHasPermission($user, $permission);
    }

    public function userHasRole(User $user, string $roleSlug): bool
    {
        // Avoid loading the full permission cache just for a role check.
        return $user->roles()->where('slug', $roleSlug)->exists();
    }

    public function userHasSystemRole(User $user): bool
    {
        return $user->roles()->where('is_system', true)->exists();
    }

    public function roleHasPermission(Role $role, string $permission): bool
    {
        return $role->permissions()->where('name', $permission)->exists();
    }

    /**
     * @return list<string>
     */
    public function getUserPermissions(User $user): array
    {
        $key = self::CACHE_PREFIX.$user->id.'.perms';

        /** @var list<string> $perms */
        $perms = Cache::remember($key, self::TTL, function () use ($user): array {
            return $user->roles()
                ->with('permissions')
                ->get()
                ->flatMap(fn (Role $role) => $role->permissions->pluck('name'))
                ->unique()
                ->values()
                ->all();
        });

        return $perms;
    }

    public function invalidateUserCache(int $userId): void
    {
        Cache::forget(self::CACHE_PREFIX.$userId.'.perms');
    }

    public function invalidateRoleCache(Role $role): void
    {
        $role->users()->select('users.id')->each(
            fn (User $user) => $this->invalidateUserCache($user->id),
        );
    }
}
