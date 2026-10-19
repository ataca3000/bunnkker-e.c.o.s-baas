<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Policies;

use App\Models\User;
use Modules\IAM\Application\Services\PermissionService;
use Modules\Operations\Loading\Domain\Models\AllocationRecord;

final class AllocationRecordPolicy
{
    public function __construct(private readonly PermissionService $permissions) {}

    public function viewAny(User $user): bool
    {
        return $this->permissions->userHasPermission($user, 'loading.allocation.view')
            || $this->permissions->userHasSystemRole($user);
    }

    public function view(User $user, AllocationRecord $record): bool
    {
        return $user->company_id === $record->company_id
            && ($this->permissions->userHasPermission($user, 'loading.allocation.view')
                || $this->permissions->userHasSystemRole($user));
    }

    public function override(User $user, AllocationRecord $record): bool
    {
        return $user->company_id === $record->company_id
            && ($this->permissions->userHasPermission($user, 'loading.allocation.override')
                || $this->permissions->userHasSystemRole($user));
    }
}
