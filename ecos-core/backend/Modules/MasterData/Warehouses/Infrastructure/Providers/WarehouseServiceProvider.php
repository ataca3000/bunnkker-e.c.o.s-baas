<?php

declare(strict_types=1);

namespace Modules\MasterData\Warehouses\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\MasterData\Warehouses\Domain\Contracts\WarehouseRepositoryInterface;
use Modules\MasterData\Warehouses\Domain\Services\WarehouseCodeGeneratorService;
use Modules\MasterData\Warehouses\Infrastructure\Repositories\EloquentWarehouseRepository;

/**
 * Service provider for the Master Data / Warehouses module.
 */
final class WarehouseServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(WarehouseRepositoryInterface::class, EloquentWarehouseRepository::class);
        $this->app->singleton(WarehouseCodeGeneratorService::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
