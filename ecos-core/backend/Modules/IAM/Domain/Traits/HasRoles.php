<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Traits;

use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Modules\IAM\Domain\Models\Role;
use Modules\IAM\Domain\Models\UserRole;

/**
 * Adds role-awareness to any Eloquent model (intended for User).
 *
 * Keeps the base User model clean; all RBAC behaviour lives in the IAM module.
 */
trait HasRoles
{
    /** @return BelongsToMany<Role, $this> */
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(
            Role::class,
            'user_roles',
            'user_id',
            'role_id',
        )->using(UserRole::class)->withTimestamps();
    }

    /**
     * Idempotently attach a role by model or slug (TASK-IAM-004). Additive — never detaches.
     */
    public function assignRole(Role|string $role): void
    {
        $model = $role instanceof Role ? $role : Role::where('slug', $role)->first();
        if ($model !== null) {
            $this->roles()->syncWithoutDetaching([$model->getKey()]);
        }
    }

    /** Detach a role by model or slug. */
    public function revokeRole(Role|string $role): void
    {
        $model = $role instanceof Role ? $role : Role::where('slug', $role)->first();
        if ($model !== null) {
            $this->roles()->detach($model->getKey());
        }
    }

    public function hasRole(string $slug): bool
    {
        return $this->roles()->where('slug', $slug)->exists();
    }
}
