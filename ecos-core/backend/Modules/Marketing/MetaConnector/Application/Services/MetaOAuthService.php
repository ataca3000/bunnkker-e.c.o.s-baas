<?php

declare(strict_types=1);

namespace Modules\Marketing\MetaConnector\Application\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Modules\Marketing\Connections\Application\Actions\DisconnectConnectionAction;
use Modules\Marketing\Connections\Domain\Contracts\MarketingOAuthContract;
use Modules\Marketing\Connections\Domain\Enums\ConnectionStatus;
use Modules\Marketing\Connections\Domain\Enums\ConnectorType;
use Modules\Marketing\Connections\Domain\Events\ConnectionCreated;
use Modules\Marketing\Connections\Domain\Events\PermissionChanged;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Modules\Marketing\MetaConnector\Domain\Services\MetaApiClient;
use Modules\Marketing\ProviderConfig\Application\Services\ProviderCredentialService;
use Modules\Marketing\ProviderPlatform\Application\Services\ProviderEventPublisher;
use RuntimeException;

/**
 * Meta OAuth lifecycle service.
 *
 * Implements MarketingOAuthContract so the core ConnectionController
 * can orchestrate the OAuth flow without knowing it's Meta.
 */
final class MetaOAuthService implements MarketingOAuthContract
{
    private const REQUIRED_SCOPES = [
        'business_management',
        'ads_management',
        'ads_read',
        'pages_show_list',
        'instagram_basic',
        'catalog_management',
        'email',
        'public_profile',
    ];

    public function __construct(
        private readonly MetaApiClient $apiClient,
        private readonly string $redirectUri,
        private readonly ProviderEventPublisher $events,
        private readonly ProviderCredentialService $providerCredentials,
        private readonly DisconnectConnectionAction $disconnectAction,
    ) {}

    /**
     * @return array{url: string, state: string}
     */
    public function buildAuthUrl(string $companyId): array
    {
        $state = Str::random(40);

        Cache::put("meta_oauth_state:{$state}", $companyId, now()->addMinutes(5));

        $url = $this->apiClient->buildAuthUrl($this->redirectUri, $state, self::REQUIRED_SCOPES);

        return ['url' => $url, 'state' => $state];
    }

    public function handleCallback(string $code, string $state, string $actorId): MarketingConnection
    {
        $companyId = Cache::pull("meta_oauth_state:{$state}");

        if ($companyId === null) {
            throw new RuntimeException('Invalid or expired OAuth state. Please retry the connection.');
        }

        $tokenData = $this->apiClient->exchangeCode($code, $this->redirectUri);
        $shortToken = $tokenData['access_token'] ?? null;

        if ($shortToken === null) {
            throw new RuntimeException('Meta did not return an access token.');
        }

        $longTokenData = $this->apiClient->extendToken($shortToken);
        $longToken = $longTokenData['access_token'];
        $expiresIn = $longTokenData['expires_in'] ?? (60 * 24 * 60 * 60);

        $me = $this->apiClient->getMe($longToken);
        $debugData = $this->apiClient->debugToken($longToken);
        $grantedScopes = $debugData['scopes'] ?? [];

        $connection = MarketingConnection::create([
            'company_id' => $companyId ?: null,
            'connector_type' => ConnectorType::Meta->value,
            'label' => "Meta — {$me['name']}",
            'status' => ConnectionStatus::Connected->value,
            'external_account_id' => $me['id'] ?? null,
            'access_token' => $longToken,
            'refresh_token' => null,
            'token_expires_at' => now()->addSeconds($expiresIn),
            'scopes' => $grantedScopes,
            'required_scopes' => self::REQUIRED_SCOPES,
            'permissions_validated_at' => now(),
            'last_validated_at' => now(),
            'connected_by' => $actorId,
            'connected_at' => now(),
        ]);

        event(new ConnectionCreated(
            connectionId: $connection->id,
            connectorType: $connection->connector_type,
            companyId: $companyId,
            actorId: $actorId,
            metadata: ['external_account_id' => $me['id'] ?? null],
        ));

        // Publish ProviderPlatform event so ProviderHealthMonitor and metrics are updated
        $this->events->providerConnected($companyId, 'meta', $actorId, $connection->id);

        // Mark provider credential as connected
        $this->providerCredentials->auditOAuthConnected($companyId, 'meta', $actorId);

        return $connection;
    }

    /**
     * Disconnect a Meta connection — revoke tokens and emit events.
     */
    public function disconnect(MarketingConnection $connection, string $actorId): MarketingConnection
    {
        $companyId = (string) $connection->company_id;

        $connection = $this->disconnectAction->execute($connection, $actorId, 'User-initiated disconnect');

        $this->events->providerDisconnected($companyId, 'meta', $actorId, $connection->id);
        $this->providerCredentials->auditOAuthDisconnected($companyId, 'meta', $actorId);

        return $connection;
    }

    /**
     * @return array{valid: bool, granted: list<string>, missing: list<string>}
     */
    public function validatePermissions(MarketingConnection $connection): array
    {
        $token = $connection->access_token;
        $debugData = $this->apiClient->debugToken($token);

        $granted = $debugData['scopes'] ?? [];
        $missing = array_values(array_diff(self::REQUIRED_SCOPES, $granted));
        $valid = empty($missing) && ($debugData['is_valid'] ?? false);

        $previousScopes = $connection->scopes ?? [];
        $added = array_values(array_diff($granted, $previousScopes));
        $removed = array_values(array_diff($previousScopes, $granted));

        $connection->update([
            'scopes' => $granted,
            'permissions_validated_at' => now(),
            'last_validated_at' => now(),
            'status' => $valid
                ? ConnectionStatus::Healthy->value
                : ConnectionStatus::Warning->value,
        ]);

        if (! empty($added) || ! empty($removed)) {
            event(new PermissionChanged(
                connectionId: $connection->id,
                connectorType: $connection->connector_type,
                addedScopes: $added,
                removedScopes: $removed,
                allGranted: $granted,
                actorId: null,
            ));
        }

        return [
            'valid' => $valid,
            'granted' => $granted,
            'missing' => $missing,
        ];
    }
}
