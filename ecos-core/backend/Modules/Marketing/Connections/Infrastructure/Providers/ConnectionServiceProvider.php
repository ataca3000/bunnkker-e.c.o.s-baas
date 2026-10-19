<?php

declare(strict_types=1);

namespace Modules\Marketing\Connections\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Marketing\Connections\Application\Actions\DisconnectConnectionAction;
use Modules\Marketing\Connections\Application\Services\ConnectorRegistry;

final class ConnectionServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(ConnectorRegistry::class);

        $this->app->bind(DisconnectConnectionAction::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(
            __DIR__.'/../Database/Migrations',
        );
    }
}
