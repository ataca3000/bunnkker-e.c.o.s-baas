<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * Permission grant entity.
 *
 * Replaces the old `role_permission` composite-PK pivot. The extra columns
 * (effect, conditions, expires_at) are architectural scaffolding for the future
 * rule engine — no business logic reads them yet.
 *
 * @property string $id
 * @property string $role_id
 * @property string $permission_id
 * @property string $effect 'allow' | 'deny'  (default: 'allow')
 * @property array|null $conditions JSON rule bag
 * @property string|null $expires_at
 * @property string $data_scope Data Scope Engine — self|team|branch|…|all (default: 'all')  [TASK-IAM-002]
 * @property array|null $scope_descriptor Descriptor bag for exotic scopes (channel/region/custom)  [TASK-IAM-002]
 */
class RolePermission extends Pivot
{
    use HasUuids;

    protected $table = 'role_permissions';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    /** @var list<string> */
    protected $fillable = [
        'role_id',
        'permission_id',
        'effect',
        'conditions',
        'expires_at',
        'data_scope',
        'scope_descriptor',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'conditions' => 'array',
            'expires_at' => 'datetime',
            'scope_descriptor' => 'array',
        ];
    }
}
