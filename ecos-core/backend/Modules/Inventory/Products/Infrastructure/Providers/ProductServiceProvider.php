<?php

declare(strict_types=1);

namespace Modules\Inventory\Products\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Inventory\Products\Application\Commands\RepairImageUrlsCommand;
use Modules\Inventory\Products\Domain\Contracts\ProductRepositoryInterface;
use Modules\Inventory\Products\Infrastructure\Repositories\EloquentProductRepository;

/**
 * Service provider for the Inventory / Products module.
 */
final class ProductServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(ProductRepositoryInterface::class, EloquentProductRepository::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');

        if ($this->app->runningInConsole()) {
            $this->commands([RepairImageUrlsCommand::class]);
        }
    }
}
