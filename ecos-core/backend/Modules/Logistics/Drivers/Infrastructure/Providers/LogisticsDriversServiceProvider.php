<?php

declare(strict_types=1);

namespace Modules\Logistics\Drivers\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Logistics\Drivers\Domain\Services\DriverVehicleAssignmentService;

final class LogisticsDriversServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(DriverVehicleAssignmentService::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
