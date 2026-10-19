<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Modules\IAM\Domain\Contracts\PermissionServiceInterface;
use Modules\IAM\Domain\Contracts\SensitiveFieldRegistryInterface;
use Modules\IAM\Domain\Contracts\VisibilityResolverInterface;
use Modules\IAM\Domain\Enums\FieldVisibility;

/**
 * VisibilityResolver — the Information Visibility Engine (TASK-IAM-002 / ADR-038, Part 2).
 *
 * A field is HIDDEN when it is declared sensitive AND the user lacks its required
 * permission. Everything else is VISIBLE. (READ_ONLY is reserved for the edit-permission
 * mapping added when write-visibility is needed; the enum already supports it.)
 *
 * Reuses the existing per-user permission cache indirectly (PermissionService is cached)
 * and memoises the per-(user,resource) hidden set for the request under an `rbac.vis.*`
 * key that is dropped by the same invalidation hooks as permissions.
 */
final class VisibilityResolver implements VisibilityResolverInterface
{
    private const CACHE_TTL = 300;

    public function __construct(
        private readonly SensitiveFieldRegistryInterface $fields,
        private readonly PermissionServiceInterface $permissions,
    ) {
    }

    public function fieldState(User $user, string $resource, string $field): FieldVisibility
    {
        $permission = $this->fields->permissionFor($resource, $field);

        // Not declared sensitive → always visible.
        if ($permission === null) {
            return FieldVisibility::VISIBLE;
        }

        return $this->permissions->userHasPermission($user, $permission)
            ? FieldVisibility::VISIBLE
            : FieldVisibility::HIDDEN;
    }

    public function hiddenFields(User $user, string $resource): array
    {
        $map = $this->fields->fieldsFor($resource);

        if ($map === []) {
            return [];
        }

        // System roles see everything.
        if ($this->permissions->userHasSystemRole($user)) {
            return [];
        }

        $key = "rbac.vis.{$user->getKey()}.{$resource}";

        /** @var list<string> $hidden */
        $hidden = Cache::remember($key, self::CACHE_TTL, function () use ($user, $map): array {
            $hidden = [];

            foreach ($map as $field => $permission) {
                if (! $this->permissions->userHasPermission($user, $permission)) {
                    $hidden[] = $field;
                }
            }

            return $hidden;
        });

        return $hidden;
    }
}
