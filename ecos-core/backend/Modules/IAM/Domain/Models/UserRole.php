<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * Role assignment entity.
 *
 * Replaces the old `user_role` composite-PK pivot. Now a first-class entity
 * with its own UUID PK and optional scope columns for future scoped RBAC.
 *
 * @property string $id
 * @property int $user_id
 * @property string $role_id
 * @property string|null $company_id
 * @property string|null $branch_id
 * @property string|null $warehouse_id
 */
class UserRole extends Pivot
{
    use HasUuids;

    protected $table = 'user_roles';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'user_id',
        'role_id',
        'company_id',
        'branch_id',
        'warehouse_id',
    ];
}
