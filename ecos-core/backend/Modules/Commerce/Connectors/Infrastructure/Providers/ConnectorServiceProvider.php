<?php

declare(strict_types=1);

namespace Modules\Commerce\Connectors\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;

final class ConnectorServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
