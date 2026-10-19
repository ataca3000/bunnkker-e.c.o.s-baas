<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Presentation\Http\Policies;

use App\Models\User;
use Modules\Organization\Brands\Domain\Models\Brand;

final class BrandPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo('organization.brands.view');
    }

    public function view(User $user, Brand $brand): bool
    {
        return $user->hasPermissionTo('organization.brands.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo('organization.brands.create');
    }

    public function update(User $user, Brand $brand): bool
    {
        return $user->hasPermissionTo('organization.brands.update');
    }

    public function delete(User $user, Brand $brand): bool
    {
        return $user->hasPermissionTo('organization.brands.delete');
    }
}
