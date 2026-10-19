<?php

declare(strict_types=1);

namespace Modules\Inventory\WarehouseLiabilities\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;

class WarehouseLiabilityServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
