<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Infrastructure\Providers;

use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use Modules\Marketing\ProviderPlatform\Application\Listeners\AuditProviderEventListener;
use Modules\Marketing\ProviderPlatform\Application\Listeners\NotifyOnProviderHealthChangeListener;
use Modules\Marketing\ProviderPlatform\Application\Listeners\TrackProviderMetricsListener;
use Modules\Marketing\ProviderPlatform\Application\Services\ProviderCapabilityEngine;
use Modules\Marketing\ProviderPlatform\Application\Services\ProviderEventPublisher;
use Modules\Marketing\ProviderPlatform\Application\Services\ProviderMetricsCollector;
use Modules\Marketing\ProviderPlatform\Application\Services\ProviderRegistry;
use Modules\Marketing\ProviderPlatform\Domain\Enums\ProviderCapability;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderConfigurationDeleted;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderConfigurationUpdated;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderConfigured;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderConnected;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderCredentialRotated;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderDisconnected;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderErrorOccurred;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderHealthChanged;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderSyncCompleted;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderSyncFailed;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderTokenExpired;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderValidated;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderValidationFailed;
use Modules\Marketing\ProviderPlatform\Domain\ValueObjects\ProviderDefinition;

final class ProviderPlatformServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(ProviderMetricsCollector::class);
        $this->app->singleton(ProviderEventPublisher::class);

        // ProviderRegistry — pre-populated with all known provider definitions.
        $this->app->singleton(ProviderRegistry::class, function (): ProviderRegistry {
            $registry = new ProviderRegistry;

            $registry->register(new ProviderDefinition(
                providerKey: 'meta',
                displayName: 'Meta (Facebook & Instagram)',
                providerType: 'social_platform',
                version: 'v21.0',
                capabilities: [
                    ProviderCapability::OAUTH,
                    ProviderCapability::WEBHOOKS,
                    ProviderCapability::CAMPAIGNS,
                    ProviderCapability::ADS,
                    ProviderCapability::ANALYTICS,
                    ProviderCapability::CATALOGS,
                    ProviderCapability::COMMERCE,
                    ProviderCapability::MESSAGING,
                    ProviderCapability::LEAD_FORMS,
                    ProviderCapability::INSTAGRAM,
                    ProviderCapability::WHATSAPP,
                ],
                documentationUrl: 'https://developers.facebook.com/docs/',
                logoUrl: null,
            ));

            $registry->register(new ProviderDefinition(
                providerKey: 'google_ads',
                displayName: 'Google Ads',
                providerType: 'advertising_platform',
                version: 'v18',
                capabilities: [
                    ProviderCapability::OAUTH,
                    ProviderCapability::CAMPAIGNS,
                    ProviderCapability::ADS,
                    ProviderCapability::ANALYTICS,
                    ProviderCapability::YOUTUBE,
                ],
                documentationUrl: 'https://developers.google.com/google-ads/api/',
            ));

            $registry->register(new ProviderDefinition(
                providerKey: 'tiktok',
                displayName: 'TikTok for Business',
                providerType: 'social_platform',
                version: 'v1.3',
                capabilities: [
                    ProviderCapability::OAUTH,
                    ProviderCapability::CAMPAIGNS,
                    ProviderCapability::ADS,
                    ProviderCapability::CATALOGS,
                ],
                documentationUrl: 'https://ads.tiktok.com/marketing_api/docs',
            ));

            $registry->register(new ProviderDefinition(
                providerKey: 'linkedin',
                displayName: 'LinkedIn Marketing Solutions',
                providerType: 'professional_network',
                version: 'v2',
                capabilities: [
                    ProviderCapability::OAUTH,
                    ProviderCapability::CAMPAIGNS,
                    ProviderCapability::ADS,
                    ProviderCapability::LEAD_FORMS,
                ],
                documentationUrl: 'https://learn.microsoft.com/en-us/linkedin/marketing/',
            ));

            $registry->register(new ProviderDefinition(
                providerKey: 'snapchat',
                displayName: 'Snapchat Ads',
                providerType: 'social_platform',
                version: 'v1',
                capabilities: [
                    ProviderCapability::OAUTH,
                    ProviderCapability::CAMPAIGNS,
                    ProviderCapability::ADS,
                ],
                documentationUrl: 'https://marketingapi.snapchat.com/docs/',
            ));

            $registry->register(new ProviderDefinition(
                providerKey: 'x_twitter',
                displayName: 'X (Twitter) Ads',
                providerType: 'social_platform',
                version: 'v2',
                capabilities: [
                    ProviderCapability::OAUTH,
                    ProviderCapability::CAMPAIGNS,
                    ProviderCapability::ADS,
                ],
                documentationUrl: 'https://developer.twitter.com/en/docs/twitter-ads-api',
            ));

            return $registry;
        });

        $this->app->singleton(ProviderCapabilityEngine::class, function ($app): ProviderCapabilityEngine {
            return new ProviderCapabilityEngine(
                registry: $app->make(ProviderRegistry::class),
            );
        });
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(
            __DIR__.'/../Database/Migrations',
        );

        $this->registerEventListeners();
    }

    private function registerEventListeners(): void
    {
        $auditor = AuditProviderEventListener::class;
        $notifier = NotifyOnProviderHealthChangeListener::class;
        $metrics = TrackProviderMetricsListener::class;

        // ── Audit OS — every event ─────────────────────────────────────────────
        $allEvents = [
            ProviderConfigured::class,
            ProviderConfigurationUpdated::class,
            ProviderConfigurationDeleted::class,
            ProviderValidated::class,
            ProviderValidationFailed::class,
            ProviderConnected::class,
            ProviderDisconnected::class,
            ProviderCredentialRotated::class,
            ProviderHealthChanged::class,
            ProviderSyncCompleted::class,
            ProviderSyncFailed::class,
            ProviderTokenExpired::class,
            ProviderErrorOccurred::class,
        ];

        foreach ($allEvents as $eventClass) {
            Event::listen($eventClass, [$auditor, 'handle']);
        }

        // ── Notification OS ────────────────────────────────────────────────────
        Event::listen(ProviderHealthChanged::class, [$notifier, 'handleHealthChanged']);
        Event::listen(ProviderTokenExpired::class, [$notifier, 'handleTokenExpired']);
        Event::listen(ProviderValidationFailed::class, [$notifier, 'handleValidationFailed']);

        // ── Monitoring / Metrics ───────────────────────────────────────────────
        Event::listen(ProviderValidated::class, [$metrics, 'handleValidated']);
        Event::listen(ProviderValidationFailed::class, [$metrics, 'handleValidationFailed']);
        Event::listen(ProviderConfigured::class, [$metrics, 'handleConfigured']);
        Event::listen(ProviderConfigurationUpdated::class, [$metrics, 'handleConfigurationUpdated']);
        Event::listen(ProviderConfigurationDeleted::class, [$metrics, 'handleConfigurationDeleted']);
        Event::listen(ProviderConnected::class, [$metrics, 'handleConnected']);
        Event::listen(ProviderDisconnected::class, [$metrics, 'handleDisconnected']);
        Event::listen(ProviderCredentialRotated::class, [$metrics, 'handleCredentialRotated']);
        Event::listen(ProviderHealthChanged::class, [$metrics, 'handleHealthChanged']);
        Event::listen(ProviderSyncCompleted::class, [$metrics, 'handleSyncCompleted']);
        Event::listen(ProviderSyncFailed::class, [$metrics, 'handleSyncFailed']);
        Event::listen(ProviderTokenExpired::class, [$metrics, 'handleTokenExpired']);
        Event::listen(ProviderErrorOccurred::class, [$metrics, 'handleErrorOccurred']);
    }
}
