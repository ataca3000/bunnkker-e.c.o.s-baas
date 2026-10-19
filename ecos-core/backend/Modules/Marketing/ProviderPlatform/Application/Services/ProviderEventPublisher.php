<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Application\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Modules\Marketing\ProviderPlatform\Domain\Events\AbstractProviderEvent;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderAssetDisconnected;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderAssetDiscovered;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderAssetPermissionRevoked;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderAssetReconnected;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderAssetRemoved;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderAssetStatusChanged;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderConfigurationDeleted;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderConfigurationUpdated;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderConfigured;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderConnected;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderCredentialRotated;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderDisconnected;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderErrorOccurred;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderHealthChanged;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderSyncCompleted;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderSyncFailed;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderSyncProgress;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderSyncStarted;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderTokenExpired;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderValidated;
use Modules\Marketing\ProviderPlatform\Domain\Events\ProviderValidationFailed;
use Throwable;

/**
 * Central publication point for all Marketing Provider Domain Events.
 *
 * Responsibilities:
 *  - Build strongly-typed event objects with standard payload
 *  - Enforce deduplication within a 3-second window
 *  - Persist every event to marketing_provider_events for audit/replay
 *  - Dispatch through Laravel event bus (listeners handle async via ShouldQueue)
 *  - Log failures without throwing — event publication must never break the call site
 *
 * Security contract: all factory methods are designed so secrets are NEVER
 * included in any event field.  The method signatures accept only safe values.
 */
final class ProviderEventPublisher
{
    private const DEDUP_TTL = 3; // seconds

    private const PROVIDER_TYPES = [
        'meta' => 'social_platform',
        'google_ads' => 'advertising_platform',
        'tiktok' => 'social_platform',
        'snapchat' => 'social_platform',
        'linkedin' => 'professional_network',
        'x_twitter' => 'social_platform',
        'pinterest' => 'social_platform',
    ];

    // ── Publish ───────────────────────────────────────────────────────────────

    public function publish(AbstractProviderEvent $event): void
    {
        if ($this->isDuplicate($event)) {
            return;
        }

        try {
            $this->persist($event);
            Event::dispatch($event);
        } catch (Throwable $e) {
            Log::error('ProviderEventPublisher: failed to publish event', [
                'event_name' => $event->eventName(),
                'company_id' => $event->companyId,
                'provider' => $event->provider,
                'error' => $e->getMessage(),
            ]);
        }
    }

    // ── Credential lifecycle factories ────────────────────────────────────────

    public function providerConfigured(
        string $companyId,
        string $provider,
        ?string $triggeredBy,
        array $metadata = [],
    ): void {
        $this->publish(new ProviderConfigured(
            companyId: $companyId,
            provider: $provider,
            providerType: $this->providerType($provider),
            triggeredBy: $triggeredBy,
            currentStatus: 'ready',
            previousStatus: null,
            correlationId: null,
            requestId: null,
            environment: (string) config('app.env'),
            metadata: $metadata,
        ));
    }

    public function providerConfigurationUpdated(
        string $companyId,
        string $provider,
        ?string $triggeredBy,
        ?string $previousStatus,
        array $metadata = [],
    ): void {
        $this->publish(new ProviderConfigurationUpdated(
            companyId: $companyId,
            provider: $provider,
            providerType: $this->providerType($provider),
            triggeredBy: $triggeredBy,
            currentStatus: 'ready',
            previousStatus: $previousStatus,
            correlationId: null,
            requestId: null,
            environment: (string) config('app.env'),
            metadata: $metadata,
        ));
    }

    public function providerConfigurationDeleted(
        string $companyId,
        string $provider,
        ?string $triggeredBy,
        ?string $previousStatus,
    ): void {
        $this->publish(new ProviderConfigurationDeleted(
            companyId: $companyId,
            provider: $provider,
            providerType: $this->providerType($provider),
            triggeredBy: $triggeredBy,
            currentStatus: 'not_configured',
            previousStatus: $previousStatus,
            correlationId: null,
            requestId: null,
            environment: (string) config('app.env'),
        ));
    }

    public function providerValidated(
        string $companyId,
        string $provider,
        ?string $triggeredBy,
        string $appId,
    ): void {
        $this->publish(new ProviderValidated(
            companyId: $companyId,
            provider: $provider,
            providerType: $this->providerType($provider),
            triggeredBy: $triggeredBy,
            currentStatus: 'ready',
            previousStatus: null,
            correlationId: null,
            requestId: null,
            environment: (string) config('app.env'),
            metadata: ['app_id' => $appId],
        ));
    }

    public function providerValidationFailed(
        string $companyId,
        string $provider,
        ?string $triggeredBy,
        string $appId,
        array $errors,
    ): void {
        $this->publish(new ProviderValidationFailed(
            companyId: $companyId,
            provider: $provider,
            providerType: $this->providerType($provider),
            triggeredBy: $triggeredBy,
            currentStatus: 'invalid',
            previousStatus: null,
            correlationId: null,
            requestId: null,
            environment: (string) config('app.env'),
            metadata: ['app_id' => $appId, 'errors' => $errors],
        ));
    }

    public function providerCredentialRotated(
        string $companyId,
        string $provider,
        ?string $triggeredBy,
    ): void {
        $this->publish(new ProviderCredentialRotated(
            companyId: $companyId,
            provider: $provider,
            providerType: $this->providerType($provider),
            triggeredBy: $triggeredBy,
            currentStatus: 'ready',
            previousStatus: 'ready',
            correlationId: null,
            requestId: null,
            environment: (string) config('app.env'),
            metadata: ['has_app_secret' => true],
        ));
    }

    // ── Health ────────────────────────────────────────────────────────────────

    public function providerHealthChanged(
        string $companyId,
        string $provider,
        string $newStatus,
        string $oldStatus,
        array $checks = [],
    ): void {
        $this->publish(new ProviderHealthChanged(
            companyId: $companyId,
            provider: $provider,
            providerType: $this->providerType($provider),
            triggeredBy: null,
            currentStatus: $newStatus,
            previousStatus: $oldStatus,
            correlationId: null,
            requestId: null,
            environment: (string) config('app.env'),
            metadata: ['checks' => $checks],
        ));
    }

    // ── OAuth ─────────────────────────────────────────────────────────────────

    public function providerConnected(
        string $companyId,
        string $provider,
        ?string $triggeredBy,
        ?string $connectionId = null,
    ): void {
        $this->publish(new ProviderConnected(
            companyId: $companyId,
            provider: $provider,
            providerType: $this->providerType($provider),
            triggeredBy: $triggeredBy,
            currentStatus: 'connected',
            previousStatus: 'ready',
            correlationId: null,
            requestId: null,
            environment: (string) config('app.env'),
            metadata: array_filter(['connection_id' => $connectionId]),
        ));
    }

    public function providerDisconnected(
        string $companyId,
        string $provider,
        ?string $triggeredBy,
        ?string $connectionId = null,
    ): void {
        $this->publish(new ProviderDisconnected(
            companyId: $companyId,
            provider: $provider,
            providerType: $this->providerType($provider),
            triggeredBy: $triggeredBy,
            currentStatus: 'ready',
            previousStatus: 'connected',
            correlationId: null,
            requestId: null,
            environment: (string) config('app.env'),
            metadata: array_filter(['connection_id' => $connectionId]),
        ));
    }

    public function providerTokenExpired(
        string $companyId,
        string $provider,
        ?string $connectionId = null,
    ): void {
        $this->publish(new ProviderTokenExpired(
            companyId: $companyId,
            provider: $provider,
            providerType: $this->providerType($provider),
            triggeredBy: null,
            currentStatus: 'token_expired',
            previousStatus: 'connected',
            correlationId: null,
            requestId: null,
            environment: (string) config('app.env'),
            metadata: array_filter(['connection_id' => $connectionId]),
        ));
    }

    // ── Sync ──────────────────────────────────────────────────────────────────

    public function providerSyncStarted(string $companyId, string $provider, string $connectionId): void
    {
        $this->publish(new ProviderSyncStarted(
            companyId: $companyId,
            provider: $provider,
            providerType: $this->providerType($provider),
            triggeredBy: null,
            currentStatus: 'connected',
            previousStatus: 'connected',
            correlationId: null,
            requestId: null,
            environment: (string) config('app.env'),
            metadata: ['connection_id' => $connectionId],
        ));
    }

    public function providerSyncCompleted(
        string $companyId,
        string $provider,
        string $connectionId,
        int $assetsDiscovered,
        int $durationSeconds,
    ): void {
        $this->publish(new ProviderSyncCompleted(
            companyId: $companyId,
            provider: $provider,
            providerType: $this->providerType($provider),
            triggeredBy: null,
            currentStatus: 'connected',
            previousStatus: 'connected',
            correlationId: null,
            requestId: null,
            environment: (string) config('app.env'),
            metadata: [
                'connection_id' => $connectionId,
                'assets_discovered' => $assetsDiscovered,
                'duration_seconds' => $durationSeconds,
            ],
        ));
    }

    public function providerSyncProgress(
        string $companyId,
        string $provider,
        string $connectionId,
        string $stage,
        int $processed,
        int $total,
    ): void {
        $this->publish(new ProviderSyncProgress(
            companyId: $companyId,
            provider: $provider,
            providerType: $this->providerType($provider),
            triggeredBy: null,
            currentStatus: 'syncing',
            previousStatus: 'syncing',
            correlationId: null,
            requestId: null,
            environment: (string) config('app.env'),
            metadata: [
                'connection_id' => $connectionId,
                'stage' => $stage,
                'processed' => $processed,
                'total' => $total,
                'percent' => $total > 0 ? round(($processed / $total) * 100) : 0,
            ],
        ));
    }

    public function providerSyncFailed(
        string $companyId,
        string $provider,
        string $connectionId,
        string $reason,
    ): void {
        $this->publish(new ProviderSyncFailed(
            companyId: $companyId,
            provider: $provider,
            providerType: $this->providerType($provider),
            triggeredBy: null,
            currentStatus: 'connected',
            previousStatus: 'connected',
            correlationId: null,
            requestId: null,
            environment: (string) config('app.env'),
            metadata: ['connection_id' => $connectionId, 'error' => $reason],
        ));
    }

    // ── Asset Lifecycle ───────────────────────────────────────────────────────

    /**
     * @param  array{asset_type: string|null, external_id: string, asset_name: string}  $assetMeta
     */
    public function providerAssetDiscovered(
        string $companyId,
        string $provider,
        string $connectionId,
        array $assetMeta,
        bool $isNew,
    ): void {
        $this->publish(new ProviderAssetDiscovered(
            companyId: $companyId,
            provider: $provider,
            providerType: $this->providerType($provider),
            triggeredBy: null,
            currentStatus: 'active',
            previousStatus: $isNew ? null : 'active',
            correlationId: null,
            requestId: null,
            environment: (string) config('app.env'),
            metadata: array_merge($assetMeta, [
                'connection_id' => $connectionId,
                'is_new' => $isNew,
            ]),
        ));
    }

    /**
     * @param  array{asset_type: string|null, external_id: string, asset_name: string}  $assetMeta
     */
    public function providerAssetStatusChanged(
        string $companyId,
        string $provider,
        string $connectionId,
        array $assetMeta,
        string $prevStatus,
        string $newStatus,
        string $reason,
    ): void {
        $this->publish(new ProviderAssetStatusChanged(
            companyId: $companyId,
            provider: $provider,
            providerType: $this->providerType($provider),
            triggeredBy: null,
            currentStatus: $newStatus,
            previousStatus: $prevStatus,
            correlationId: null,
            requestId: null,
            environment: (string) config('app.env'),
            metadata: array_merge($assetMeta, [
                'connection_id' => $connectionId,
                'reason' => $reason,
            ]),
        ));
    }

    /**
     * @param  array{asset_type: string|null, external_id: string, asset_name: string}  $assetMeta
     */
    public function providerAssetDisconnected(
        string $companyId,
        string $provider,
        string $connectionId,
        array $assetMeta,
        string $reason,
    ): void {
        $this->publish(new ProviderAssetDisconnected(
            companyId: $companyId,
            provider: $provider,
            providerType: $this->providerType($provider),
            triggeredBy: null,
            currentStatus: 'disconnected',
            previousStatus: 'active',
            correlationId: null,
            requestId: null,
            environment: (string) config('app.env'),
            metadata: array_merge($assetMeta, [
                'connection_id' => $connectionId,
                'reason' => $reason,
            ]),
        ));
    }

    /**
     * @param  array{asset_type: string|null, external_id: string, asset_name: string}  $assetMeta
     */
    public function providerAssetReconnected(
        string $companyId,
        string $provider,
        string $connectionId,
        array $assetMeta,
        string $previousStatus,
    ): void {
        $this->publish(new ProviderAssetReconnected(
            companyId: $companyId,
            provider: $provider,
            providerType: $this->providerType($provider),
            triggeredBy: null,
            currentStatus: 'active',
            previousStatus: $previousStatus,
            correlationId: null,
            requestId: null,
            environment: (string) config('app.env'),
            metadata: array_merge($assetMeta, [
                'connection_id' => $connectionId,
            ]),
        ));
    }

    /**
     * @param  array{asset_type: string|null, external_id: string, asset_name: string}  $assetMeta
     */
    public function providerAssetRemoved(
        string $companyId,
        string $provider,
        string $connectionId,
        array $assetMeta,
        string $reason,
    ): void {
        $this->publish(new ProviderAssetRemoved(
            companyId: $companyId,
            provider: $provider,
            providerType: $this->providerType($provider),
            triggeredBy: null,
            currentStatus: 'removed_from_provider',
            previousStatus: 'active',
            correlationId: null,
            requestId: null,
            environment: (string) config('app.env'),
            metadata: array_merge($assetMeta, [
                'connection_id' => $connectionId,
                'reason' => $reason,
            ]),
        ));
    }

    /**
     * @param  array{asset_type: string|null, external_id: string, asset_name: string}  $assetMeta
     */
    public function providerAssetPermissionRevoked(
        string $companyId,
        string $provider,
        string $connectionId,
        array $assetMeta,
        string $reason,
    ): void {
        $this->publish(new ProviderAssetPermissionRevoked(
            companyId: $companyId,
            provider: $provider,
            providerType: $this->providerType($provider),
            triggeredBy: null,
            currentStatus: 'access_revoked',
            previousStatus: 'active',
            correlationId: null,
            requestId: null,
            environment: (string) config('app.env'),
            metadata: array_merge($assetMeta, [
                'connection_id' => $connectionId,
                'reason' => $reason,
            ]),
        ));
    }

    // ── Error ─────────────────────────────────────────────────────────────────

    public function providerErrorOccurred(
        string $companyId,
        string $provider,
        string $currentStatus,
        string $errorClass,
        string $errorMessage,
    ): void {
        $this->publish(new ProviderErrorOccurred(
            companyId: $companyId,
            provider: $provider,
            providerType: $this->providerType($provider),
            triggeredBy: null,
            currentStatus: $currentStatus,
            previousStatus: null,
            correlationId: null,
            requestId: null,
            environment: (string) config('app.env'),
            metadata: ['error_class' => $errorClass, 'error_message' => $errorMessage],
        ));
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private function isDuplicate(AbstractProviderEvent $event): bool
    {
        $key = 'provider_event_dedup:'.md5(
            $event->eventName().$event->companyId.$event->provider.$event->currentStatus,
        );

        if (Cache::has($key)) {
            return true;
        }

        Cache::put($key, true, self::DEDUP_TTL);

        return false;
    }

    private function persist(AbstractProviderEvent $event): void
    {
        DB::table('marketing_provider_events')->insert([
            'id' => $event->eventId,
            'event_name' => $event->eventName(),
            'company_id' => $event->companyId,
            'provider' => $event->provider,
            'provider_type' => $event->providerType,
            'current_status' => $event->currentStatus,
            'previous_status' => $event->previousStatus,
            'triggered_by' => $event->triggeredBy,
            'correlation_id' => $event->correlationId,
            'environment' => $event->environment,
            'metadata' => json_encode($event->metadata),
            // occurredAt is ISO 8601 (e.g. '2026-07-21T00:41:41.873733Z'); MySQL TIMESTAMP
            // rejects the timezone suffix, so parse through Carbon first.
            'occurred_at' => \Carbon\Carbon::parse($event->occurredAt),
            'created_at' => now(),
        ]);
    }

    private function providerType(string $providerKey): string
    {
        return self::PROVIDER_TYPES[$providerKey] ?? 'external_provider';
    }
}
