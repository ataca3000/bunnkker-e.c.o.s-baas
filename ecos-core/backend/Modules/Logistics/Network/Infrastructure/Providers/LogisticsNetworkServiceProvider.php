<?php

declare(strict_types=1);

namespace Modules\Logistics\Network\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Logistics\Network\Domain\Services\CapacityLedgerService;
use Modules\Logistics\Network\Domain\Services\CoverageResolverService;
use Modules\Logistics\Network\Domain\Services\ServiceAreaService;

/**
 * Network — service areas, coverage, dispatch regions and capacity.
 *
 * Also carries D1: nullable latitude/longitude on logistics_cities, the single
 * CTO-approved additive extension to a V1 table. Routing needs points, and
 * duplicating geography in a V2 table would violate Directive 8.
 */
final class LogisticsNetworkServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(CoverageResolverService::class);
        $this->app->singleton(CapacityLedgerService::class);
        $this->app->singleton(ServiceAreaService::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
