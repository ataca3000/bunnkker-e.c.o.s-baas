<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Application\Listeners;

use Modules\Marketing\ProviderPlatform\Application\Services\ProviderMetricsCollector;
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

/**
 * Routes provider domain events to the MetricsCollector.
 *
 * Runs synchronously — metric increments are fast Redis operations.
 * The Monitoring OS reads these counters to build provider health timelines.
 */
final class TrackProviderMetricsListener
{
    public function __construct(
        private readonly ProviderMetricsCollector $metrics,
    ) {}

    public function handleValidated(ProviderValidated $event): void
    {
        $this->metrics->recordValidationSuccess($event->companyId, $event->provider);
    }

    public function handleValidationFailed(ProviderValidationFailed $event): void
    {
        $this->metrics->recordValidationFailure($event->companyId, $event->provider);
    }

    public function handleConfigured(ProviderConfigured $event): void
    {
        $this->metrics->recordConfigChange($event->companyId, $event->provider);
    }

    public function handleConfigurationUpdated(ProviderConfigurationUpdated $event): void
    {
        $this->metrics->recordConfigChange($event->companyId, $event->provider);
    }

    public function handleConfigurationDeleted(ProviderConfigurationDeleted $event): void
    {
        $this->metrics->recordConfigChange($event->companyId, $event->provider);
    }

    public function handleConnected(ProviderConnected $event): void
    {
        $this->metrics->recordOAuthSuccess($event->companyId, $event->provider);
    }

    public function handleDisconnected(ProviderDisconnected $event): void
    {
        $this->metrics->recordOAuthFailure($event->companyId, $event->provider);
    }

    public function handleCredentialRotated(ProviderCredentialRotated $event): void
    {
        $this->metrics->recordConfigChange($event->companyId, $event->provider);
    }

    public function handleHealthChanged(ProviderHealthChanged $event): void
    {
        $this->metrics->recordHealthChange($event->companyId, $event->provider);
    }

    public function handleSyncCompleted(ProviderSyncCompleted $event): void
    {
        $this->metrics->recordSyncSuccess($event->companyId, $event->provider);
    }

    public function handleSyncFailed(ProviderSyncFailed $event): void
    {
        $this->metrics->recordSyncFailure($event->companyId, $event->provider);
    }

    public function handleTokenExpired(ProviderTokenExpired $event): void
    {
        $this->metrics->recordTokenExpiry($event->companyId, $event->provider);
    }

    public function handleErrorOccurred(ProviderErrorOccurred $event): void
    {
        $this->metrics->recordApiError($event->companyId, $event->provider);
    }
}
