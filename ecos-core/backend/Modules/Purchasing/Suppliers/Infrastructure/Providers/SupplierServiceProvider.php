<?php

declare(strict_types=1);

namespace Modules\Purchasing\Suppliers\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Purchasing\Suppliers\Domain\Contracts\SupplierRepositoryInterface;
use Modules\Purchasing\Suppliers\Infrastructure\Repositories\EloquentSupplierRepository;

/**
 * Service provider for the Purchasing / Suppliers module.
 */
final class SupplierServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(SupplierRepositoryInterface::class, EloquentSupplierRepository::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
