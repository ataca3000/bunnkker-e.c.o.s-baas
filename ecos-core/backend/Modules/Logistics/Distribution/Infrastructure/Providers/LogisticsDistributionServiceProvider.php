<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;

final class LogisticsDistributionServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
