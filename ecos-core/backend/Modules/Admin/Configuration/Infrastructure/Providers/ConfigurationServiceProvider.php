<?php

declare(strict_types=1);

namespace Modules\Admin\Configuration\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Admin\Configuration\Domain\Services\ConfigAuditService;
use Modules\Admin\Configuration\Domain\Services\ConfigurationManager;

final class ConfigurationServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(ConfigAuditService::class);

        $this->app->singleton(
            ConfigurationManager::class,
            fn ($app) => new ConfigurationManager($app->make(ConfigAuditService::class)),
        );
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');
    }
}
