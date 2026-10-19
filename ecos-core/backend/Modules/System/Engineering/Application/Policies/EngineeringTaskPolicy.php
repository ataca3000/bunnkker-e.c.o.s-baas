<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Policies;

use App\Models\User;
use Modules\System\Engineering\Domain\Models\EngineeringTask;

final class EngineeringTaskPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('engineering.inbox.view')
            || $user->hasRole(['admin', 'super_admin', 'engineer']);
    }

    public function view(User $user, EngineeringTask $task): bool
    {
        return $this->viewAny($user) && $task->company_id === $user->company_id;
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('engineering.inbox.create')
            || $user->hasRole(['admin', 'super_admin', 'engineer']);
    }

    public function update(User $user, EngineeringTask $task): bool
    {
        return $task->company_id === $user->company_id
            && ($user->hasPermissionTo('engineering.inbox.update')
                || $user->hasRole(['admin', 'super_admin']));
    }

    public function delete(User $user, EngineeringTask $task): bool
    {
        return $task->company_id === $user->company_id
            && ($user->hasPermissionTo('engineering.inbox.delete')
                || $user->hasRole(['admin', 'super_admin']));
    }

    public function transition(User $user, EngineeringTask $task): bool
    {
        return $this->update($user, $task);
    }

    public function assign(User $user, EngineeringTask $task): bool
    {
        return $task->company_id === $user->company_id
            && $user->hasRole(['admin', 'super_admin', 'engineering_manager']);
    }

    public function manageReleases(User $user): bool
    {
        return $user->hasPermissionTo('engineering.releases.manage')
            || $user->hasRole(['admin', 'super_admin', 'engineering_manager']);
    }
}
