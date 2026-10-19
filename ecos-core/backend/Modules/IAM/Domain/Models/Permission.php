<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * RBAC Permission entity.
 *
 * Permissions follow the three-segment hierarchical convention:
 *   {domain}.{resource}.{action}
 *
 * Examples:
 *   inventory.products.view
 *   sales.orders.fulfill
 *   crm.customers.update
 *   iam.roles.assign
 *
 * @property string $id
 * @property string $name Full permission name (domain.resource.action)
 * @property string $module Top-level domain  (e.g. "inventory", "sales", "crm")
 * @property string $resource Resource within domain (e.g. "products", "orders")
 * @property string $action Action  (e.g. "view", "create", "fulfill")
 * @property string|null $description
 * @property string|null $group_id Optional FK to permission_groups (TASK-IAM-002 Phase 1)
 */
class Permission extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'name',
        'module',
        'resource',
        'action',
        'description',
        'group_id',
    ];

    /** @return BelongsToMany<Role, $this> */
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(
            Role::class,
            'role_permissions',
            'permission_id',
            'role_id',
        )->using(RolePermission::class);
    }

    /**
     * Optional permission group (TASK-IAM-002 Phase 1). Null for every existing
     * permission until grouping is performed in a later phase.
     *
     * @return BelongsTo<PermissionGroup, $this>
     */
    public function group(): BelongsTo
    {
        return $this->belongsTo(PermissionGroup::class, 'group_id');
    }
}
