<?php

declare(strict_types=1);

namespace Modules\Marketing\MetaConnector\Application\Listeners;

use Modules\Marketing\Connections\Domain\Enums\ConnectorType;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Modules\Marketing\ProviderPlatform\Application\Services\ProviderEventPublisher;
use Modules\Marketing\Synchronization\Domain\Events\SynchronizationCompleted;
use Modules\Marketing\Synchronization\Domain\Events\SynchronizationFailed;
use Modules\Marketing\Synchronization\Domain\Events\SynchronizationStarted;

/**
 * Bridges Synchronization domain events to ProviderPlatform events.
 *
 * Runs synchronously (no ShouldQueue) because it only calls the publisher
 * which itself is non-blocking (never throws).
 *
 * Only bridges Meta connector events — other connectors are ignored here.
 */
final class BridgeSyncEventsToProviderPlatform
{
    public function __construct(
        private readonly ProviderEventPublisher $events,
    ) {}

    public function handleStarted(SynchronizationStarted $event): void
    {
        $connection = MarketingConnection::find($event->connectionId);
        if ($connection === null || $connection->connector_type !== ConnectorType::Meta) {
            return;
        }

        $this->events->providerSyncStarted(
            companyId: (string) $connection->company_id,
            provider: 'meta',
            connectionId: $connection->id,
        );
    }

    public function handleCompleted(SynchronizationCompleted $event): void
    {
        $connection = MarketingConnection::find($event->syncLog->marketing_connection_id);
        if ($connection === null || $connection->connector_type !== ConnectorType::Meta) {
            return;
        }

        $started = $event->syncLog->started_at;
        $completed = $event->syncLog->completed_at ?? now();
        $duration = $started ? (int) $started->diffInSeconds($completed) : 0;

        $this->events->providerSyncCompleted(
            companyId: (string) $connection->company_id,
            provider: 'meta',
            connectionId: $connection->id,
            assetsDiscovered: $event->assetsDiscovered,
            durationSeconds: $duration,
        );
    }

    public function handleFailed(SynchronizationFailed $event): void
    {
        $connection = MarketingConnection::find($event->syncLog->marketing_connection_id);
        if ($connection === null || $connection->connector_type !== ConnectorType::Meta) {
            return;
        }

        $this->events->providerSyncFailed(
            companyId: (string) $connection->company_id,
            provider: 'meta',
            connectionId: $connection->id,
            reason: $event->errorMessage,
        );
    }
}
