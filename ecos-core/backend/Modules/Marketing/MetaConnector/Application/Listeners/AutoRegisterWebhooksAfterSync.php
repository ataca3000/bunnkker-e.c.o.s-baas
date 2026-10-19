<?php

declare(strict_types=1);

namespace Modules\Marketing\MetaConnector\Application\Listeners;

use Illuminate\Contracts\Queue\ShouldQueue;
use Modules\Marketing\Connections\Domain\Enums\ConnectorType;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Modules\Marketing\MetaConnector\Application\Services\MetaWebhookService;
use Modules\Marketing\Synchronization\Domain\Enums\SyncType;
use Modules\Marketing\Synchronization\Domain\Events\SynchronizationCompleted;

/**
 * After a Full sync completes on a Meta connection, auto-register all
 * standard webhooks for that connection.
 *
 * Queued so that the HTTP calls to Meta never block the sync thread.
 * Guards: Meta connector only + Full sync type only.
 */
final class AutoRegisterWebhooksAfterSync implements ShouldQueue
{
    public string $queue = 'default';

    public function __construct(
        private readonly MetaWebhookService $webhookService,
    ) {}

    public function handle(SynchronizationCompleted $event): void
    {
        if ($event->syncLog->sync_type !== SyncType::Full->value) {
            return;
        }

        $connection = MarketingConnection::find($event->syncLog->marketing_connection_id);

        if ($connection === null || $connection->connector_type !== ConnectorType::Meta) {
            return;
        }

        $this->webhookService->registerAll($connection);
    }
}
