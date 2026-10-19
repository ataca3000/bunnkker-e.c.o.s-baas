<?php

declare(strict_types=1);

namespace Modules\Marketing\Assets\Application\Services;

use Modules\Marketing\Assets\Domain\Enums\AssetHealth;
use Modules\Marketing\Assets\Domain\Models\MarketingAsset;
use Modules\Marketing\Connections\Application\Services\ConnectorRegistry;
use Throwable;

/**
 * Checks and updates the health status of marketing assets.
 */
final class AssetHealthService
{
    public function __construct(private readonly ConnectorRegistry $registry) {}

    /**
     * Check and persist health for a single asset.
     */
    public function check(MarketingAsset $asset): string
    {
        $asset->loadMissing('connection');
        $connection = $asset->connection;

        if ($connection === null) {
            return $this->stamp($asset, AssetHealth::Disconnected->value, ['reason' => 'connection_missing']);
        }

        if (! $this->registry->has($asset->connector_type->value)) {
            return $this->stamp($asset, AssetHealth::Unknown->value, ['reason' => 'no_connector']);
        }

        $connector = $this->registry->get($asset->connector_type->value);

        try {
            $health = $connector->checkAssetHealth($asset, $connection);
        } catch (Throwable $e) {
            $health = AssetHealth::SyncFailed->value;

            return $this->stamp($asset, $health, ['error' => $e->getMessage()]);
        }

        return $this->stamp($asset, $health, []);
    }

    /**
     * Bulk check health for all assets belonging to a connection.
     *
     * @return array{healthy: int, warning: int, error: int}
     */
    public function checkForConnection(string $connectionId): array
    {
        $counts = ['healthy' => 0, 'warning' => 0, 'error' => 0];

        MarketingAsset::where('marketing_connection_id', $connectionId)
            ->each(function (MarketingAsset $asset) use (&$counts): void {
                $health = $this->check($asset);

                match (true) {
                    $health === AssetHealth::Healthy->value => $counts['healthy']++,
                    in_array($health, [
                        AssetHealth::Warning->value,
                        AssetHealth::Inactive->value,
                    ], true) => $counts['warning']++,
                    default => $counts['error']++,
                };
            });

        return $counts;
    }

    private function stamp(MarketingAsset $asset, string $health, array $meta): string
    {
        $asset->update([
            'health_status' => $health,
            'health_checked_at' => now(),
            'health_metadata' => $meta ?: null,
        ]);

        return $health;
    }
}
