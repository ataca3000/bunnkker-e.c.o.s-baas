<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * RBAC Role entity.
 *
 * @property string $id
 * @property string $name
 * @property string $slug
 * @property string|null $description
 * @property bool $is_system When true, the role bypasses all permission checks.
 *                           Never hardcode role slugs for the bypass — check is_system.
 */
class Role extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'name',
        'slug',
        'description',
        'is_system',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'is_system' => 'boolean',
        ];
    }

    /** @return BelongsToMany<Permission, $this> */
    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(
            Permission::class,
            'role_permissions',
            'role_id',
            'permission_id',
        )->using(RolePermission::class)->withPivot('effect', 'conditions', 'expires_at');
    }

    /** @return BelongsToMany<\App\Models\User, $this> */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(
            \App\Models\User::class,
            'user_roles',
            'role_id',
            'user_id',
        )->using(UserRole::class)->withTimestamps();
    }
}
