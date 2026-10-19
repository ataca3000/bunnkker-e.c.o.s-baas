<?php

declare(strict_types=1);

namespace Modules\Logistics\Vehicles\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Logistics\Vehicles\Domain\Contracts\VehicleRepositoryInterface;
use Modules\Logistics\Vehicles\Domain\Services\VehicleMaintenanceService;
use Modules\Logistics\Vehicles\Domain\Services\VehicleService;
use Modules\Logistics\Vehicles\Infrastructure\Repositories\EloquentVehicleRepository;

final class LogisticsVehiclesServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(VehicleRepositoryInterface::class, EloquentVehicleRepository::class);
        $this->app->singleton(VehicleService::class);
        $this->app->singleton(VehicleMaintenanceService::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
