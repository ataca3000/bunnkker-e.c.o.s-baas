<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Policies;

use App\Models\User;
use Modules\IAM\Application\Services\PermissionService;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

final class PreparationWavePolicy
{
    public function __construct(private readonly PermissionService $permissions) {}

    public function viewAny(User $user): bool
    {
        return $this->permissions->userHasPermission($user, 'preparation.wave.view')
            || $this->permissions->userHasSystemRole($user);
    }

    public function view(User $user, PreparationWave $wave): bool
    {
        return $this->sameCompany($user, $wave)
            && ($this->permissions->userHasPermission($user, 'preparation.wave.view')
                || $this->permissions->userHasSystemRole($user));
    }

    public function create(User $user): bool
    {
        return $this->permissions->userHasPermission($user, 'preparation.wave.create')
            || $this->permissions->userHasSystemRole($user);
    }

    public function generateDemand(User $user, PreparationWave $wave): bool
    {
        return $this->sameCompany($user, $wave)
            && ($this->permissions->userHasPermission($user, 'preparation.wave.update')
                || $this->permissions->userHasSystemRole($user));
    }

    public function analyzeMaterials(User $user, PreparationWave $wave): bool
    {
        return $this->sameCompany($user, $wave)
            && ($this->permissions->userHasPermission($user, 'preparation.wave.update')
                || $this->permissions->userHasSystemRole($user));
    }

    public function approve(User $user, PreparationWave $wave): bool
    {
        return $this->sameCompany($user, $wave)
            && ($this->permissions->userHasPermission($user, 'preparation.wave.approve')
                || $this->permissions->userHasSystemRole($user));
    }

    public function start(User $user, PreparationWave $wave): bool
    {
        return $this->sameCompany($user, $wave)
            && ($this->permissions->userHasPermission($user, 'preparation.wave.start')
                || $this->permissions->userHasSystemRole($user));
    }

    public function completeItem(User $user, PreparationWave $wave): bool
    {
        return $this->sameCompany($user, $wave)
            && ($this->permissions->userHasPermission($user, 'preparation.wave.update')
                || $this->permissions->userHasSystemRole($user));
    }

    public function complete(User $user, PreparationWave $wave): bool
    {
        return $this->sameCompany($user, $wave)
            && ($this->permissions->userHasPermission($user, 'preparation.wave.complete')
                || $this->permissions->userHasSystemRole($user));
    }

    public function cancel(User $user, PreparationWave $wave): bool
    {
        return $this->sameCompany($user, $wave)
            && ($this->permissions->userHasPermission($user, 'preparation.wave.cancel')
                || $this->permissions->userHasSystemRole($user));
    }

    public function recalculate(User $user, PreparationWave $wave): bool
    {
        return $this->sameCompany($user, $wave)
            && ($this->permissions->userHasPermission($user, 'preparation.wave.update')
                || $this->permissions->userHasSystemRole($user));
    }

    public function resolveShortage(User $user, PreparationWave $wave): bool
    {
        return $this->sameCompany($user, $wave)
            && ($this->permissions->userHasPermission($user, 'preparation.shortage.resolve')
                || $this->permissions->userHasPermission($user, 'preparation.wave.start')
                || $this->permissions->userHasSystemRole($user));
    }

    public function assignWorker(User $user, PreparationWave $wave): bool
    {
        return $this->sameCompany($user, $wave)
            && ($this->permissions->userHasPermission($user, 'preparation.worker.assign')
                || $this->permissions->userHasSystemRole($user));
    }

    public function releaseWorker(User $user, PreparationWave $wave): bool
    {
        return $this->sameCompany($user, $wave)
            && ($this->permissions->userHasPermission($user, 'preparation.worker.release')
                || $this->permissions->userHasSystemRole($user));
    }

    private function sameCompany(User $user, PreparationWave $wave): bool
    {
        return (string) $user->company_id === (string) $wave->company_id;
    }
}
