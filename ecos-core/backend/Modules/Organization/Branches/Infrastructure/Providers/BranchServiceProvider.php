<?php

declare(strict_types=1);

namespace Modules\Organization\Branches\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Organization\Branches\Domain\Contracts\BranchRepositoryInterface;
use Modules\Organization\Branches\Infrastructure\Repositories\EloquentBranchRepository;

/**
 * Service provider for the Organization / Branches module.
 */
final class BranchServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(BranchRepositoryInterface::class, EloquentBranchRepository::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
