<?php

declare(strict_types=1);

namespace Modules\Commerce\Shipping\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Commerce\Shipping\Domain\Contracts\ShippingEngineContract;
use Modules\Commerce\Shipping\Domain\Services\ShippingValidationService;

final class ShippingServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Bind the contract to the concrete implementation.
        // Swap this binding in tests or to introduce provider-specific engines.
        $this->app->bind(ShippingEngineContract::class, ShippingValidationService::class);
    }

    public function boot(): void {}
}
