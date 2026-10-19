<?php

declare(strict_types=1);

namespace Modules\IAM\Presentation\Policies;

use App\Models\User;

/**
 * Authorization for the Enterprise User Management Platform (ADR-040). All abilities map to
 * the additive `iam.users.*` permission catalog. Super-admin bypass is global (Gate::before).
 */
class UserPolicy extends BasePolicy
{
    public function viewAny(User $user): bool
    {
        return $this->can($user, 'iam.users.view');
    }

    public function view(User $user, User $target): bool
    {
        return $this->can($user, 'iam.users.view');
    }

    public function create(User $user): bool
    {
        return $this->can($user, 'iam.users.create');
    }

    public function update(User $user, User $target): bool
    {
        return $this->can($user, 'iam.users.update');
    }

    public function delete(User $user, User $target): bool
    {
        return $this->can($user, 'iam.users.delete');
    }

    public function activate(User $user, User $target): bool
    {
        return $this->can($user, 'iam.users.activate');
    }

    public function suspend(User $user, User $target): bool
    {
        return $this->can($user, 'iam.users.suspend');
    }

    public function assignRole(User $user, User $target): bool
    {
        return $this->can($user, 'iam.users.assign-role');
    }

    public function assignOrganization(User $user, User $target): bool
    {
        return $this->can($user, 'iam.users.assign-org');
    }

    public function invite(User $user, User $target): bool
    {
        return $this->can($user, 'iam.users.invite');
    }

    public function resetPassword(User $user, User $target): bool
    {
        return $this->can($user, 'iam.users.reset-password');
    }

    public function manageSessions(User $user, User $target): bool
    {
        return $this->can($user, 'iam.users.manage-sessions');
    }
}
