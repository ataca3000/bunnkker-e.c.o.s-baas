<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Policies;

use App\Models\User;
use Modules\IAM\Application\Services\PermissionService;
use Modules\Operations\Loading\Domain\Models\LoadingSession;

final class LoadingSessionPolicy
{
    public function __construct(private readonly PermissionService $permissions) {}

    public function viewAny(User $user): bool
    {
        return $this->permissions->userHasPermission($user, 'loading.session.view')
            || $this->permissions->userHasSystemRole($user);
    }

    public function view(User $user, LoadingSession $session): bool
    {
        return $user->company_id === $session->company_id
            && ($this->permissions->userHasPermission($user, 'loading.session.view')
                || $this->permissions->userHasSystemRole($user));
    }

    public function create(User $user): bool
    {
        return $this->permissions->userHasPermission($user, 'loading.session.create')
            || $this->permissions->userHasSystemRole($user);
    }

    public function cancel(User $user, LoadingSession $session): bool
    {
        return $user->company_id === $session->company_id
            && ($this->permissions->userHasPermission($user, 'loading.session.cancel')
                || $this->permissions->userHasSystemRole($user));
    }

    public function operate(User $user, LoadingSession $session): bool
    {
        return $user->company_id === $session->company_id
            && ($this->permissions->userHasPermission($user, 'loading.session.operate')
                || $this->permissions->userHasSystemRole($user));
    }

    public function dispatch(User $user, LoadingSession $session): bool
    {
        return $user->company_id === $session->company_id
            && ($this->permissions->userHasPermission($user, 'loading.session.dispatch')
                || $this->permissions->userHasSystemRole($user));
    }

    public function allocate(User $user, LoadingSession $session): bool
    {
        return $user->company_id === $session->company_id
            && ($this->permissions->userHasPermission($user, 'loading.allocation.manage')
                || $this->permissions->userHasSystemRole($user));
    }
}
