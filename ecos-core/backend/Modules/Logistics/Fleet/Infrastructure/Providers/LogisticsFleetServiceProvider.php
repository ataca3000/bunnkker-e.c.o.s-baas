<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Infrastructure\Providers;

use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Modules\Logistics\Fleet\Domain\Contracts\FleetReadinessQueryInterface;
use Modules\Logistics\Fleet\Domain\Contracts\FleetUnitRepositoryInterface;
use Modules\Logistics\Fleet\Domain\Models\FleetUnit;
use Modules\Logistics\Fleet\Domain\Services\DefectService;
use Modules\Logistics\Fleet\Domain\Services\FleetReadinessService;
use Modules\Logistics\Fleet\Domain\Services\FleetUnitService;
use Modules\Logistics\Fleet\Domain\Services\FuelReconciliationService;
use Modules\Logistics\Fleet\Domain\Services\InspectionService;
use Modules\Logistics\Fleet\Domain\Services\MaintenanceSchedulingService;
use Modules\Logistics\Fleet\Domain\Services\OdometerService;
use Modules\Logistics\Fleet\Domain\Services\VehicleCostService;
use Modules\Logistics\Fleet\Infrastructure\Repositories\EloquentFleetUnitRepository;
use Modules\Logistics\Fleet\Presentation\Policies\FleetPolicy;

final class LogisticsFleetServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(FleetUnitRepositoryInterface::class, EloquentFleetUnitRepository::class);

        // The readiness seam (Directive 3): declared and implemented by Fleet,
        // consumed by Dispatch. Delivery and Distribution do not bind to it.
        $this->app->bind(FleetReadinessQueryInterface::class, FleetReadinessService::class);

        $this->app->singleton(OdometerService::class);
        $this->app->singleton(FleetReadinessService::class);
        $this->app->singleton(VehicleCostService::class);
        $this->app->singleton(MaintenanceSchedulingService::class);
        $this->app->singleton(FleetUnitService::class);
        $this->app->singleton(InspectionService::class);
        $this->app->singleton(DefectService::class);
        $this->app->singleton(FuelReconciliationService::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');

        Gate::policy(FleetUnit::class, FleetPolicy::class);
    }
}
