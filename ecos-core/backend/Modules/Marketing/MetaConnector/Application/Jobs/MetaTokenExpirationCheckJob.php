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
use Modules\Marketing\MetaConnector\Domain\Services\MetaApiClient;
use Modules\Marketing\ProviderConfig\Application\Services\ProviderCredentialContext;
use Modules\Marketing\ProviderPlatform\Application\Services\ProviderEventPublisher;
use Throwable;

/**
 * Checks whether a Meta access token is still valid.
 *
 * When a token is found to be expired or invalid:
 *   - Updates connection status to Expired
 *   - Publishes ProviderTokenExpired event
 *   - Invalidates ProviderHealthMonitor cache
 *
 * Scheduled every 6 hours by MetaConnectorServiceProvider.
 */
final class MetaTokenExpirationCheckJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public int $timeout = 30;

    public function __construct(
        private readonly string $connectionId,
        private readonly string $companyId,
    ) {}

    public function handle(
        ProviderEventPublisher $events,
        ProviderCredentialContext $context,
    ): void {
        $connection = MarketingConnection::find($this->connectionId);

        if ($connection === null || $connection->access_token === null) {
            return;
        }

        // Skip tokens that appear to be expired by timestamp (fast path)
        if ($connection->token_expires_at !== null && $connection->token_expires_at->isPast()) {
            $this->markExpired($connection, $events, 'Token expiry timestamp exceeded');

            return;
        }

        // Lazy-resolve the API client with the company context set
        $context->set($this->companyId);

        try {
            $apiClient = app(MetaApiClient::class);
            $result = $apiClient->inspectToken($connection->access_token);

            if (! $result['is_valid']) {
                $this->markExpired($connection, $events, 'Meta API reports token invalid');
            } elseif ($result['expires_at'] !== null) {
                // Update token_expires_at if it differs from what we stored
                $connection->update(['token_expires_at' => \Carbon\Carbon::createFromTimestamp($result['expires_at'])]);
            }
        } catch (Throwable $e) {
            Log::warning('MetaTokenExpirationCheckJob: failed to inspect token', [
                'connection_id' => $this->connectionId,
                'error' => $e->getMessage(),
            ]);
        } finally {
            $context->clear();
        }
    }

    private function markExpired(
        MarketingConnection $connection,
        ProviderEventPublisher $events,
        string $reason,
    ): void {
        $connection->update(['status' => ConnectionStatus::Expired->value]);

        $events->providerTokenExpired(
            companyId: (string) $connection->company_id,
            provider: 'meta',
            connectionId: $connection->id,
        );

        Log::info('MetaTokenExpirationCheckJob: token expired', [
            'connection_id' => $this->connectionId,
            'reason' => $reason,
        ]);
    }
}
