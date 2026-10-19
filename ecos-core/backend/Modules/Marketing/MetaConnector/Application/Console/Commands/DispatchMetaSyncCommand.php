<?php

declare(strict_types=1);

namespace Modules\Marketing\MetaConnector\Application\Console\Commands;

use Illuminate\Console\Command;
use Modules\Marketing\Connections\Domain\Enums\ConnectionStatus;
use Modules\Marketing\Connections\Domain\Enums\ConnectorType;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Modules\Marketing\MetaConnector\Application\Jobs\MetaIncrementalSyncJob;
use Modules\Marketing\MetaConnector\Application\Jobs\MetaTokenExpirationCheckJob;

/**
 * Dispatch incremental sync and/or token expiration checks for all active Meta connections.
 *
 * Usage:
 *   php artisan meta:sync               — dispatch incremental sync for all connections
 *   php artisan meta:sync --token-check — dispatch token expiration check only
 *   php artisan meta:sync --company=... — scope to a single company
 */
final class DispatchMetaSyncCommand extends Command
{
    protected $signature = 'meta:sync
        {--token-check : Run token expiration checks instead of sync}
        {--company=    : Limit to a specific company ID}
        {--full        : Dispatch full sync instead of incremental}';

    protected $description = 'Dispatch Meta incremental sync (or token checks) for all active connections';

    public function handle(): int
    {
        $query = MarketingConnection::where('connector_type', ConnectorType::Meta->value)
            ->whereIn('status', [
                ConnectionStatus::Connected->value,
                ConnectionStatus::Healthy->value,
            ]);

        if ($this->option('company')) {
            $query->where('company_id', $this->option('company'));
        }

        $connections = $query->get();

        if ($connections->isEmpty()) {
            $this->info('No active Meta connections found.');

            return self::SUCCESS;
        }

        $tokenCheck = (bool) $this->option('token-check');
        $dispatched = 0;

        foreach ($connections as $connection) {
            $companyId = (string) $connection->company_id;

            if ($tokenCheck) {
                MetaTokenExpirationCheckJob::dispatch($connection->id, $companyId);
            } else {
                MetaIncrementalSyncJob::dispatch($connection->id, $companyId);
            }

            $dispatched++;
        }

        $mode = $tokenCheck ? 'token check' : 'incremental sync';
        $this->info("Dispatched {$dispatched} Meta {$mode} jobs.");

        return self::SUCCESS;
    }
}
