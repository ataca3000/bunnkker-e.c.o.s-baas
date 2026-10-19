<?php

declare(strict_types=1);

namespace Modules\Logistics\ShippingCompanies\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;

final class LogisticsShippingCompaniesServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
