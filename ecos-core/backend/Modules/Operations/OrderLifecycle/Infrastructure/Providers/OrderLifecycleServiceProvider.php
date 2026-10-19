<?php

declare(strict_types=1);

namespace Modules\Operations\OrderLifecycle\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Operations\OrderLifecycle\Application\Handlers\ManufacturingLifecycleHandler;
use Modules\Operations\OrderLifecycle\Application\Services\OrderLifecycleCoordinator;

final class OrderLifecycleServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(
            OrderLifecycleCoordinator::class,
            function ($app): OrderLifecycleCoordinator {
                return new OrderLifecycleCoordinator(
                    handlers: [
                        $app->make(ManufacturingLifecycleHandler::class),
                        // Future handlers registered here:
                        // $app->make(ShippingLifecycleHandler::class),
                        // $app->make(AccountingLifecycleHandler::class),
                    ],
                );
            },
        );
    }
}
