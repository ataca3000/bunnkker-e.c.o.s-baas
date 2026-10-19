<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderConfig\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Admin\Configuration\Domain\Services\ConfigAuditService;
use Modules\Marketing\ProviderConfig\Application\Console\Commands\DispatchProviderHealthChecksCommand;
use Modules\Marketing\ProviderConfig\Application\Services\MetaConfigValidator;
use Modules\Marketing\ProviderConfig\Application\Services\ProviderCredentialContext;
use Modules\Marketing\ProviderConfig\Application\Services\ProviderCredentialService;
use Modules\Marketing\ProviderConfig\Application\Services\ProviderHealthMonitor;
use Modules\Marketing\ProviderConfig\Application\Services\ValidatorRegistry;
use Modules\Marketing\ProviderPlatform\Application\Services\ProviderEventPublisher;

final class ProviderConfigServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Explicit company context for queue workers (singleton — one per process).
        $this->app->singleton(ProviderCredentialContext::class);

        // Validator implementations.
        $this->app->singleton(MetaConfigValidator::class);

        // Validator registry — all provider validators registered here at boot.
        $this->app->singleton(ValidatorRegistry::class, function ($app): ValidatorRegistry {
            $registry = new ValidatorRegistry;
            $registry->register('meta', $app->make(MetaConfigValidator::class));

            return $registry;
        });

        // Central credential service — depends on registry, not individual validators.
        $this->app->singleton(ProviderCredentialService::class, function ($app): ProviderCredentialService {
            return new ProviderCredentialService(
                validators: $app->make(ValidatorRegistry::class),
                audit: $app->make(ConfigAuditService::class),
                events: $app->make(ProviderEventPublisher::class),
            );
        });

        // Health monitor — depends on credential service and audit.
        $this->app->singleton(ProviderHealthMonitor::class, function ($app): ProviderHealthMonitor {
            return new ProviderHealthMonitor(
                credentials: $app->make(ProviderCredentialService::class),
                audit: $app->make(ConfigAuditService::class),
                events: $app->make(ProviderEventPublisher::class),
            );
        });
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(
            __DIR__.'/../Database/Migrations',
        );

        if ($this->app->runningInConsole()) {
            $this->commands([
                DispatchProviderHealthChecksCommand::class,
            ]);
        }
    }
}
