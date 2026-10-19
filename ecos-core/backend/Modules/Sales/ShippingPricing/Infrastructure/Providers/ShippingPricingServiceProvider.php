<?php

declare(strict_types=1);

namespace Modules\Sales\ShippingPricing\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;

final class ShippingPricingServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
