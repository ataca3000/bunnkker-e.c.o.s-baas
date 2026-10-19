<?php

declare(strict_types=1);

namespace Modules\Logistics\Geography\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;

final class LogisticsGeographyServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
