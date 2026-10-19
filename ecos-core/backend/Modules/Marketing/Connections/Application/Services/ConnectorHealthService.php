<?php

declare(strict_types=1);

namespace Modules\Marketing\Connections\Application\Services;

use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Modules\Marketing\Connections\Domain\ValueObjects\ConnectorHealthData;

/**
 * Aggregates connector-level health for a connection.
 *
 * Distinct from AssetHealthService (which is per-asset).
 * Delegates to the registered connector's checkConnectorHealth() then
 * optionally persists the result back to marketing_connections health columns.
 */
final class ConnectorHealthService
{
    public function __construct(
        private readonly ConnectorRegistry $registry,
    ) {}

    public function check(MarketingConnection $connection): ConnectorHealthData
    {
        if (! $this->registry->has($connection->connector_type->value)) {
            return ConnectorHealthData::unavailable(
                "No connector registered for type [{$connection->connector_type->value}].",
            );
        }

        $connector = $this->registry->get($connection->connector_type->value);
        $healthData = $connector->checkConnectorHealth($connection);

        // Persist the health snapshot to the connection record
        $connection->update([
            'api_status' => $healthData->apiAvailable ? 'available' : 'unavailable',
            'rate_limit_remaining' => $healthData->rateLimitRemaining,
            'rate_limit_reset_at' => $healthData->rateLimitResetAt,
            'avg_sync_duration_seconds' => $healthData->avgSyncDurationSeconds,
            'last_successful_sync_at' => $healthData->lastSuccessfulSyncAt,
            'last_failed_sync_at' => $healthData->lastFailedSyncAt,
            'error_count' => $healthData->errorCount,
        ]);

        return $healthData;
    }
}
