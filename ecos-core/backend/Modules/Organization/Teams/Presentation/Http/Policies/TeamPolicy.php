<?php

declare(strict_types=1);

namespace Modules\Organization\Teams\Presentation\Http\Policies;

use App\Models\User;
use Modules\Organization\Teams\Domain\Models\Team;

final class TeamPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('organization.teams.view');
    }

    public function view(User $user, Team $team): bool
    {
        return $user->hasPermissionTo('organization.teams.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('organization.teams.create');
    }

    public function update(User $user, Team $team): bool
    {
        return $user->hasPermissionTo('organization.teams.update');
    }

    public function delete(User $user, Team $team): bool
    {
        return $user->hasPermissionTo('organization.teams.delete');
    }
}
