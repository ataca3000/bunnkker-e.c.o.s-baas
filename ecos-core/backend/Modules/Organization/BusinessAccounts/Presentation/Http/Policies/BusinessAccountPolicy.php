<?php

declare(strict_types=1);

namespace Modules\Organization\BusinessAccounts\Presentation\Http\Policies;

use App\Models\User;
use Modules\Organization\BusinessAccounts\Domain\Models\BusinessAccount;

final class BusinessAccountPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('organization.business_accounts.view');
    }

    public function view(User $user, BusinessAccount $account): bool
    {
        return $user->hasPermissionTo('organization.business_accounts.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('organization.business_accounts.create');
    }

    public function update(User $user, BusinessAccount $account): bool
    {
        return $user->hasPermissionTo('organization.business_accounts.update');
    }

    public function delete(User $user, BusinessAccount $account): bool
    {
        return $user->hasPermissionTo('organization.business_accounts.delete');
    }
}
