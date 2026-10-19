<?php

declare(strict_types=1);

namespace Modules\Logistics\Carriers\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Logistics\Carriers\Domain\Services\CarrierAdapterFactory;
use Modules\Logistics\Carriers\Infrastructure\Adapters\InternalFleetAdapter;

/**
 * Carriers — the integration FOUNDATION.
 *
 * Phase 2 registers the internal fleet adapter only. Provider-specific adapters
 * arrive later, in business-priority order (D4/D7), each as a new class in its
 * own folder registered here — nothing outside that folder changes.
 */
final class LogisticsCarriersServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(CarrierAdapterFactory::class, static function (): CarrierAdapterFactory {
            return new CarrierAdapterFactory([
                // Own fleet is a first-class carrier, so the core cannot tell
                // the difference between delivering ourselves and tendering out.
                new InternalFleetAdapter,
            ]);
        });
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
