<?php

declare(strict_types=1);

namespace Modules\Commerce\ProductMappings\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Commerce\ProductMappings\Domain\Contracts\ProductMappingRepositoryInterface;
use Modules\Commerce\ProductMappings\Infrastructure\Repositories\EloquentProductMappingRepository;

final class ProductMappingServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(ProductMappingRepositoryInterface::class, EloquentProductMappingRepository::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
