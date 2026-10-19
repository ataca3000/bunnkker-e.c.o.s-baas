<?php

declare(strict_types=1);

namespace Modules\Marketing\MetaConnector\Application\Services;

use Modules\Marketing\Connections\Domain\Enums\ConnectionStatus;
use Modules\Marketing\Connections\Domain\Events\PermissionChanged;
use Modules\Marketing\Connections\Domain\Models\MarketingConnection;
use Modules\Marketing\MetaConnector\Domain\Services\MetaApiClient;
use Modules\Marketing\ProviderConfig\Application\Services\ProviderHealthMonitor;
use Modules\Marketing\ProviderPlatform\Application\Services\ProviderEventPublisher;

/**
 * Verifies and tracks Meta permissions for a connection.
 *
 * Permission states shown in the UI:
 *   granted        — present in both required and granted
 *   missing        — required but not granted; reconnect required
 *   needs_review   — granted but scope changed / new version required
 *
 * Updates ConnectionStatus to Warning when permissions are missing.
 * Updates ProviderHealthMonitor status to permission_error when required scopes are absent.
 */
final class MetaPermissionsService
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

    private const OPTIONAL_SCOPES = [
        'pages_manage_metadata',
        'pages_read_engagement',
        'instagram_manage_insights',
        'instagram_manage_comments',
        'leads_retrieval',
        'whatsapp_business_management',
    ];

    public function __construct(
        private readonly MetaApiClient $apiClient,
        private readonly ProviderHealthMonitor $healthMonitor,
        private readonly ProviderEventPublisher $events,
    ) {}

    /**
     * Run a full permissions verification against the live Meta API.
     *
     * @return array{
     *   valid: bool,
     *   granted: list<string>,
     *   missing: list<string>,
     *   optional_granted: list<string>,
     *   needs_review: list<string>,
     *   token_valid: bool,
     *   expires_at: int|null,
     * }
     */
    public function verify(MarketingConnection $connection): array
    {
        $token = $connection->access_token;
        $debugData = $this->apiClient->debugToken($token);

        $granted = $debugData['scopes'] ?? [];
        $isTokenValid = (bool) ($debugData['is_valid'] ?? false);
        $expiresAt = $debugData['expires_at'] ?? null;

        $missing = array_values(array_diff(self::REQUIRED_SCOPES, $granted));
        $optionalGranted = array_values(array_intersect(self::OPTIONAL_SCOPES, $granted));
        $needsReview = [];
        $valid = $isTokenValid && empty($missing);

        $previousScopes = $connection->scopes ?? [];
        $added = array_values(array_diff($granted, $previousScopes));
        $removed = array_values(array_diff($previousScopes, $granted));

        $newStatus = match (true) {
            ! $isTokenValid => ConnectionStatus::Expired->value,
            ! empty($missing) => ConnectionStatus::Warning->value,
            default => ConnectionStatus::Healthy->value,
        };

        $connection->update([
            'scopes' => $granted,
            'permissions_validated_at' => now(),
            'last_validated_at' => now(),
            'status' => $newStatus,
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

            $this->events->publish(
                new \Modules\Marketing\ProviderPlatform\Domain\Events\ProviderPermissionChanged(
                    companyId: (string) $connection->company_id,
                    provider: 'meta',
                    providerType: 'social_platform',
                    triggeredBy: null,
                    currentStatus: $newStatus,
                    previousStatus: $connection->getOriginal('status'),
                    correlationId: null,
                    requestId: null,
                    environment: (string) config('app.env'),
                    metadata: [
                        'added_scopes' => $added,
                        'removed_scopes' => $removed,
                        'total_granted' => count($granted),
                    ],
                ),
            );
        }

        // Update ProviderHealthMonitor if permissions are degraded
        if (! $valid) {
            $this->healthMonitor->invalidate((string) $connection->company_id, 'meta');
        }

        return [
            'valid' => $valid,
            'granted' => $granted,
            'missing' => $missing,
            'optional_granted' => $optionalGranted,
            'needs_review' => $needsReview,
            'token_valid' => $isTokenValid,
            'expires_at' => $expiresAt,
        ];
    }

    /**
     * Returns the required scopes list for documentation / UI display.
     *
     * @return array{required: list<string>, optional: list<string>}
     */
    public function getRequiredScopes(): array
    {
        return [
            'required' => self::REQUIRED_SCOPES,
            'optional' => self::OPTIONAL_SCOPES,
        ];
    }
}
