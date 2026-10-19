<?php

declare(strict_types=1);

namespace Modules\MasterData\Categories\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\MasterData\Categories\Domain\Contracts\CategoryRepositoryInterface;
use Modules\MasterData\Categories\Infrastructure\Repositories\EloquentCategoryRepository;

/**
 * Service provider for the Master Data / Categories module.
 */
final class CategoryServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(CategoryRepositoryInterface::class, EloquentCategoryRepository::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
