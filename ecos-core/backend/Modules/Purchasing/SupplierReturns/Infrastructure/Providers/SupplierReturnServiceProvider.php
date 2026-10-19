<?php

declare(strict_types=1);

namespace Modules\Purchasing\SupplierReturns\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;

final class SupplierReturnServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
