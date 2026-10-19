<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Policies;

use App\Models\User;
use Modules\IAM\Application\Services\PermissionService;

final class PreparationStationPolicy
{
    public function __construct(private readonly PermissionService $permissions) {}

    public function viewAny(User $user): bool
    {
        return $this->permissions->userHasPermission($user, 'preparation.station.view')
            || $this->permissions->userHasSystemRole($user);
    }

    public function manage(User $user): bool
    {
        return $this->permissions->userHasPermission($user, 'preparation.station.manage')
            || $this->permissions->userHasSystemRole($user);
    }
}
