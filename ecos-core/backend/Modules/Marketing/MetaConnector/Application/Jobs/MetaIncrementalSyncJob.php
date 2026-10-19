<?php

declare(strict_types=1);

namespace Modules\Marketing\MetaConnector\Application\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Modules\Marketing\Connections\Domain\Enums\ConnectionStatus;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Modules\Marketing\ProviderConfig\Application\Services\ProviderCredentialContext;
use Modules\Marketing\Synchronization\Application\Actions\RunSyncAction;
use Modules\Marketing\Synchronization\Domain\Enums\SyncType;

/**
 * Queued incremental sync for a single Meta connection.
 *
 * Safe to dispatch from console commands and webhooks.
 * Sets ProviderCredentialContext before resolving the connector so
 * MetaConnectorServiceProvider resolves the correct company credentials.
 */
final class MetaIncrementalSyncJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public int $timeout = 120;

    public array $backoff = [30, 90]; // 30 s → 90 s — rate-limit courtesy delay

    public function __construct(
        private readonly string $connectionId,
        private readonly string $companyId,
        private readonly SyncType $syncType = SyncType::Incremental,
    ) {}

    public function handle(
        RunSyncAction $runSync,
        ProviderCredentialContext $context,
    ): void {
        $connection = MarketingConnection::find($this->connectionId);

        if ($connection === null) {
            Log::warning('MetaIncrementalSyncJob: connection not found', ['connection_id' => $this->connectionId]);

            return;
        }

        if (! in_array($connection->status->value, [
            ConnectionStatus::Connected->value,
            ConnectionStatus::Healthy->value,
        ], true)) {
            Log::info('MetaIncrementalSyncJob: skipping — connection not active', [
                'connection_id' => $this->connectionId,
                'status' => $connection->status->value,
            ]);

            return;
        }

        $context->set($this->companyId);

        try {
            $runSync->execute($connection, $this->syncType, null);
        } finally {
            $context->clear();
        }
    }
}
