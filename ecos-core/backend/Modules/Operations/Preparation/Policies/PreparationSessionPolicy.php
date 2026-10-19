<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Policies;

use App\Models\User;
use Modules\IAM\Application\Services\PermissionService;
use Modules\Operations\Preparation\Domain\Models\PreparationSession;

final class PreparationSessionPolicy
{
    public function __construct(private readonly PermissionService $permissions) {}

    public function viewAny(User $user): bool
    {
        return $this->permissions->userHasPermission($user, 'preparation.session.view')
            || $this->permissions->userHasSystemRole($user);
    }

    public function view(User $user, PreparationSession $session): bool
    {
        return $this->sameCompany($user, $session)
            && ($this->permissions->userHasPermission($user, 'preparation.session.view')
                || $this->permissions->userHasSystemRole($user));
    }

    public function create(User $user): bool
    {
        return $this->permissions->userHasPermission($user, 'preparation.session.create')
            || $this->permissions->userHasSystemRole($user);
    }

    public function start(User $user, PreparationSession $session): bool
    {
        return $this->sameCompany($user, $session)
            && ($this->permissions->userHasPermission($user, 'preparation.session.manage')
                || $this->permissions->userHasSystemRole($user));
    }

    public function complete(User $user, PreparationSession $session): bool
    {
        return $this->sameCompany($user, $session)
            && ($this->permissions->userHasPermission($user, 'preparation.session.manage')
                || $this->permissions->userHasSystemRole($user));
    }

    public function cancel(User $user, PreparationSession $session): bool
    {
        return $this->sameCompany($user, $session)
            && ($this->permissions->userHasPermission($user, 'preparation.session.cancel')
                || $this->permissions->userHasSystemRole($user));
    }

    public function addWave(User $user, PreparationSession $session): bool
    {
        return $this->sameCompany($user, $session)
            && ($this->permissions->userHasPermission($user, 'preparation.session.manage')
                || $this->permissions->userHasSystemRole($user));
    }

    private function sameCompany(User $user, PreparationSession $session): bool
    {
        return (string) $user->company_id === (string) $session->company_id;
    }
}
