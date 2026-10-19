<?php

declare(strict_types=1);

namespace Modules\Marketing\Connections\Application\Abstracts;

use Modules\Marketing\Assets\Domain\Models\MarketingAsset;
use Modules\Marketing\Connections\Domain\Contracts\MarketingConnectorInterface;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Modules\Marketing\Connections\Domain\ValueObjects\ConnectorHealthData;
use Modules\Marketing\Synchronization\Domain\Models\MarketingSyncLog;
use Throwable;

/**
 * Base connector with sensible defaults.
 *
 * Concrete connectors (MetaConnector, GoogleAdsConnector, etc.) extend this class
 * and override only what is provider-specific.
 */
abstract class AbstractMarketingConnector implements MarketingConnectorInterface
{
    // ── Defaults that most connectors share ───────────────────────────────────

    public function getCapabilities(): array
    {
        return ['oauth', 'asset_discovery', 'health_check', 'sync'];
    }

    public function getProviderMetadata(): array
    {
        return [
            'name' => $this->getDisplayName(),
            'logo_url' => null,
            'documentation_url' => null,
            'api_version' => null,
            'description' => null,
        ];
    }

    // ── Default connector health (uses sync log data) ─────────────────────────

    public function checkConnectorHealth(MarketingConnection $connection): ConnectorHealthData
    {
        $lastSuccess = MarketingSyncLog::where('marketing_connection_id', $connection->id)
            ->where('status', 'completed')
            ->latest('completed_at')
            ->value('completed_at');

        $lastFailed = MarketingSyncLog::where('marketing_connection_id', $connection->id)
            ->where('status', 'failed')
            ->latest('completed_at')
            ->value('completed_at');

        $errorCount = MarketingSyncLog::where('marketing_connection_id', $connection->id)
            ->where('status', 'failed')
            ->where('started_at', '>=', now()->subDays(7))
            ->count();

        $avgDuration = (int) (MarketingSyncLog::where('marketing_connection_id', $connection->id)
            ->where('status', 'completed')
            ->whereNotNull('started_at')
            ->whereNotNull('completed_at')
            ->selectRaw('AVG(TIMESTAMPDIFF(SECOND, started_at, completed_at)) as avg_duration')
            ->value('avg_duration') ?? 0);

        $authStatus = $connection->isTokenExpired()
            ? 'expired'
            : ($connection->isActive() ? 'valid' : 'unknown');

        return new ConnectorHealthData(
            connectionStatus: $connection->status->value,
            authStatus: $authStatus,
            tokenExpiresAt: $connection->token_expires_at?->toIso8601String(),
            apiAvailable: $connection->isActive() && ! $connection->isTokenExpired(),
            rateLimitRemaining: null,
            rateLimitResetAt: null,
            avgSyncDurationSeconds: $avgDuration > 0 ? $avgDuration : null,
            lastSuccessfulSyncAt: $lastSuccess?->toIso8601String(),
            lastFailedSyncAt: $lastFailed?->toIso8601String(),
            errorCount: $errorCount,
            retryQueueSize: 0,
        );
    }

    // ── Shared helpers ────────────────────────────────────────────────────────

    /**
     * Call a discovery closure; return empty array on any exception.
     * This prevents per-asset-type API failures from aborting a full sync.
     *
     * @template T
     *
     * @param  callable(): T  $fn
     * @return T|list<never>
     */
    protected function safeDiscover(callable $fn): array
    {
        try {
            return $fn();
        } catch (Throwable) {
            return [];
        }
    }

    /**
     * Default asset health check — override in connector for deeper inspection.
     */
    public function checkAssetHealth(MarketingAsset $asset, MarketingConnection $connection): string
    {
        if (! $connection->isActive()) {
            return 'disconnected';
        }

        if ($connection->isTokenExpired()) {
            return 'expired_token';
        }

        if ($asset->status === 'inactive') {
            return 'inactive';
        }

        return 'healthy';
    }
}
