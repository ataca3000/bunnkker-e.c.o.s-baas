<?php

declare(strict_types=1);

namespace Modules\Marketing\MetaConnector\Infrastructure\Providers;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Modules\Marketing\Connections\Application\Actions\DisconnectConnectionAction;
use Modules\Marketing\Connections\Application\Services\ConnectorRegistry;
use Modules\Marketing\MetaConnector\Application\Console\Commands\DispatchMetaSyncCommand;
use Modules\Marketing\MetaConnector\Application\Jobs\MetaWebhookRetryJob;
use Modules\Marketing\MetaConnector\Application\Listeners\AutoRegisterWebhooksAfterSync;
use Modules\Marketing\MetaConnector\Application\Listeners\BridgeSyncEventsToProviderPlatform;
use Modules\Marketing\MetaConnector\Application\Services\MetaConnector;
use Modules\Marketing\MetaConnector\Application\Services\MetaOAuthService;
use Modules\Marketing\MetaConnector\Application\Services\MetaPermissionsService;
use Modules\Marketing\MetaConnector\Application\Services\MetaWebhookService;
use Modules\Marketing\MetaConnector\Domain\Services\MetaApiClient;
use Modules\Marketing\ProviderConfig\Application\Services\ProviderCredentialContext;
use Modules\Marketing\ProviderConfig\Application\Services\ProviderCredentialService;
use Modules\Marketing\ProviderConfig\Application\Services\ProviderHealthMonitor;
use Modules\Marketing\ProviderPlatform\Application\Services\ProviderEventPublisher;
use Modules\Marketing\Synchronization\Domain\Events\SynchronizationCompleted;
use Modules\Marketing\Synchronization\Domain\Events\SynchronizationFailed;
use Modules\Marketing\Synchronization\Domain\Events\SynchronizationStarted;

final class MetaConnectorServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // All three bindings resolve company ID in the same priority order:
        //   1. ProviderCredentialContext — set explicitly by queue jobs
        //   2. Authenticated HTTP request user — normal web/API requests
        //   3. Empty string — unauthenticated context; callers must check isConfigured()

        $this->app->bind(MetaApiClient::class, function ($app): MetaApiClient {
            $companyId = $this->resolveCompanyId($app);
            $service = $app->make(ProviderCredentialService::class);
            $cred = $companyId ? $service->find($companyId, 'meta') : null;

            return new MetaApiClient(
                appId: (string) ($cred?->app_id ?? ''),
                appSecret: (string) ($cred?->app_secret ?? ''),
            );
        });

        $this->app->bind(MetaOAuthService::class, function ($app): MetaOAuthService {
            $companyId = $this->resolveCompanyId($app);
            $service = $app->make(ProviderCredentialService::class);
            $cred = $companyId ? $service->find($companyId, 'meta') : null;
            $uri = (string) ($cred?->redirect_uri ?? $service->defaultRedirectUri('meta'));

            return new MetaOAuthService(
                apiClient: $app->make(MetaApiClient::class),
                redirectUri: $uri,
                events: $app->make(ProviderEventPublisher::class),
                providerCredentials: $app->make(ProviderCredentialService::class),
                disconnectAction: $app->make(DisconnectConnectionAction::class),
            );
        });

        $this->app->bind(MetaConnector::class, function ($app): MetaConnector {
            $companyId = $this->resolveCompanyId($app);
            $service = $app->make(ProviderCredentialService::class);
            $cred = $companyId ? $service->find($companyId, 'meta') : null;
            $uri = (string) ($cred?->redirect_uri ?? $service->defaultRedirectUri('meta'));

            return new MetaConnector(
                apiClient: $app->make(MetaApiClient::class),
                oauthService: $app->make(MetaOAuthService::class),
                redirectUri: $uri,
            );
        });

        $this->app->bind(MetaWebhookService::class, function ($app): MetaWebhookService {
            return new MetaWebhookService(
                apiClient: $app->make(MetaApiClient::class),
                events: $app->make(ProviderEventPublisher::class),
            );
        });

        $this->app->bind(MetaPermissionsService::class, function ($app): MetaPermissionsService {
            return new MetaPermissionsService(
                apiClient: $app->make(MetaApiClient::class),
                healthMonitor: $app->make(ProviderHealthMonitor::class),
                events: $app->make(ProviderEventPublisher::class),
            );
        });
    }

    public function boot(): void
    {
        // Defer connector registration until ConnectorRegistry is first resolved so that
        // resolveCompanyId() runs after the authenticated request user is available, not
        // during the boot phase when $request->user() is always null.
        $this->callAfterResolving(ConnectorRegistry::class, function (ConnectorRegistry $registry): void {
            $registry->register($this->app->make(MetaConnector::class));
        });

        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');

        $this->commands([
            DispatchMetaSyncCommand::class,
        ]);

        $this->registerListeners();
        $this->registerSchedule();
    }

    private function registerListeners(): void
    {
        Event::listen(
            SynchronizationStarted::class,
            [BridgeSyncEventsToProviderPlatform::class, 'handleStarted'],
        );

        Event::listen(
            SynchronizationCompleted::class,
            [BridgeSyncEventsToProviderPlatform::class, 'handleCompleted'],
        );

        Event::listen(
            SynchronizationFailed::class,
            [BridgeSyncEventsToProviderPlatform::class, 'handleFailed'],
        );

        // Auto-register webhooks after a Full sync completes (queued — no network calls on the sync thread)
        Event::listen(
            SynchronizationCompleted::class,
            [AutoRegisterWebhooksAfterSync::class, 'handle'],
        );
    }

    private function registerSchedule(): void
    {
        $this->callAfterResolving(Schedule::class, function (Schedule $schedule): void {
            // Incremental sync every 30 minutes for all active Meta connections
            $schedule->command('meta:sync')
                ->everyThirtyMinutes()
                ->withoutOverlapping()
                ->runInBackground()
                ->name('meta:sync:incremental');

            // Token expiry check every 6 hours
            $schedule->command('meta:sync --token-check')
                ->everySixHours()
                ->withoutOverlapping()
                ->runInBackground()
                ->name('meta:sync:token-check');

            // Retry failed webhook registrations once daily
            $schedule->job(MetaWebhookRetryJob::class)
                ->dailyAt('03:00')
                ->withoutOverlapping()
                ->name('meta:webhooks:retry');
        });
    }

    /**
     * Resolves the active company ID from:
     *  1. ProviderCredentialContext (explicit — used by queue jobs)
     *  2. Authenticated HTTP request user (web/API context)
     */
    private function resolveCompanyId($app): string
    {
        $context = $app->make(ProviderCredentialContext::class);
        $explicit = $context->get();

        if ($explicit !== null) {
            return $explicit;
        }

        return (string) ($app['request']->user()?->company_id ?? '');
    }
}
