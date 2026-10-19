<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Policies;

use App\Models\User;
use Modules\IAM\Application\Services\PermissionService;
use Modules\Operations\Preparation\Domain\Models\PreparedProductsPool;

final class PreparedPoolPolicy
{
    public function __construct(private readonly PermissionService $permissions) {}

    public function viewAny(User $user): bool
    {
        return $this->permissions->userHasPermission($user, 'preparation.pool.view')
            || $this->permissions->userHasSystemRole($user);
    }

    public function updateQuality(User $user, PreparedProductsPool $pool): bool
    {
        return (string) $user->company_id === (string) $pool->company_id
            && ($this->permissions->userHasPermission($user, 'preparation.pool.manage')
                || $this->permissions->userHasSystemRole($user));
    }
}
