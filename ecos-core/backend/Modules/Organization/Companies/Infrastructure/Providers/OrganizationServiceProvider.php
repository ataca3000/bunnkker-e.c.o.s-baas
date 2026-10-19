<?php

declare(strict_types=1);

namespace Modules\Organization\Companies\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Organization\Companies\Domain\Contracts\CompanyRepositoryInterface;
use Modules\Organization\Companies\Infrastructure\Repositories\EloquentCompanyRepository;

/**
 * Service provider for the Organization / Companies module.
 */
final class OrganizationServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(CompanyRepositoryInterface::class, EloquentCompanyRepository::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
