<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Policies;

use App\Models\User;
use Modules\IAM\Application\Services\PermissionService;
use Modules\Operations\Loading\Domain\Models\VehicleAssignment;

final class VehicleAssignmentPolicy
{
    public function __construct(private readonly PermissionService $permissions) {}

    public function viewAny(User $user): bool
    {
        return $this->permissions->userHasPermission($user, 'loading.session.view')
            || $this->permissions->userHasSystemRole($user);
    }

    public function view(User $user, VehicleAssignment $assignment): bool
    {
        return $user->company_id === $assignment->company_id
            && ($this->permissions->userHasPermission($user, 'loading.session.view')
                || $this->permissions->userHasSystemRole($user));
    }

    public function create(User $user): bool
    {
        return $this->permissions->userHasPermission($user, 'loading.vehicle.assign')
            || $this->permissions->userHasSystemRole($user);
    }

    public function load(User $user, VehicleAssignment $assignment): bool
    {
        return $user->company_id === $assignment->company_id
            && ($this->permissions->userHasPermission($user, 'loading.session.operate')
                || $this->permissions->userHasSystemRole($user));
    }

    public function dispatch(User $user, VehicleAssignment $assignment): bool
    {
        return $user->company_id === $assignment->company_id
            && ($this->permissions->userHasPermission($user, 'loading.session.dispatch')
                || $this->permissions->userHasSystemRole($user));
    }

    public function reconcile(User $user, VehicleAssignment $assignment): bool
    {
        return $user->company_id === $assignment->company_id
            && ($this->permissions->userHasPermission($user, 'loading.session.operate')
                || $this->permissions->userHasSystemRole($user));
    }
}
