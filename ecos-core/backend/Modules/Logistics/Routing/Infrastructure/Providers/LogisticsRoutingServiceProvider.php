<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Logistics\Routing\Domain\Services\EtaEngine;
use Modules\Logistics\Routing\Domain\Services\RoutePlannerService;
use Modules\Logistics\Routing\Domain\Services\RoutingStrategyResolver;
use Modules\Logistics\Routing\Domain\Strategies\NearestNeighbourStrategy;
use Modules\Logistics\Routing\Domain\Strategies\SequentialZoneStrategy;

/**
 * Routing — sequence and path.
 *
 * The resolver is where strategies register. Adding the future AI optimiser
 * (deferred; Phase 2 is deterministic only) means registering one more
 * implementation here — no existing code changes (Directive 10).
 */
final class LogisticsRoutingServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(RoutingStrategyResolver::class, static function (): RoutingStrategyResolver {
            return new RoutingStrategyResolver([
                // The always-available baseline. Needs no coordinates, and
                // everything else is measured against it.
                new SequentialZoneStrategy,
                // Deterministic geometric improvement. Refuses when stops are
                // not geocoded, and the resolver falls back.
                new NearestNeighbourStrategy,
            ]);
        });

        $this->app->singleton(EtaEngine::class);
        $this->app->singleton(RoutePlannerService::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
