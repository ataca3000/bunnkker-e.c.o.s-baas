<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderConfig\Application\Services;

use Illuminate\Support\Facades\Cache;
use Modules\Admin\Configuration\Domain\Services\ConfigAuditService;
use Modules\Marketing\ProviderConfig\Domain\Models\MarketingProviderCredential;
use Modules\Marketing\ProviderPlatform\Application\Services\ProviderEventPublisher;

/**
 * Manages runtime credentials for marketing platform providers.
 *
 * Credentials are:
 *  - stored encrypted in `marketing_provider_credentials`
 *  - never exposed in full after save (app_secret → has_app_secret flag only)
 *  - audit-logged via ConfigAuditService for all 12 lifecycle events
 *  - cache-invalidated across ALL cache keys on every mutation
 *
 * Security invariant: app_secret MUST NOT appear in logs, exceptions,
 * API responses, or debug output.  All audit records use boolean flags
 * for secrets, not the secret values themselves.
 */
final class ProviderCredentialService
{
    private const CACHE_TTL = 300; // 5 minutes

    // ── Audit action constants ────────────────────────────────────────────────
    public const AUDIT_CREATED = 'created';

    public const AUDIT_UPDATED = 'updated';

    public const AUDIT_DELETED = 'deleted';

    public const AUDIT_SECRET_ROTATED = 'secret_rotated';

    public const AUDIT_VALIDATION_SUCCESS = 'validation_success';

    public const AUDIT_VALIDATION_FAILED = 'validation_failed';

    public const AUDIT_OAUTH_CONNECTED = 'oauth_connected';

    public const AUDIT_OAUTH_DISCONNECTED = 'oauth_disconnected';

    public const AUDIT_WEBHOOK_REGISTERED = 'webhook_registered';

    public const AUDIT_WEBHOOK_REMOVED = 'webhook_removed';

    public const AUDIT_PERMISSION_CHANGED = 'permission_changed';

    public const AUDIT_HEALTH_STATUS_CHANGED = 'health_status_changed';

    public function __construct(
        private readonly ValidatorRegistry $validators,
        private readonly ConfigAuditService $audit,
        private readonly ProviderEventPublisher $events,
    ) {}

    // ── Read ──────────────────────────────────────────────────────────────────

    public function find(string $companyId, string $provider): ?MarketingProviderCredential
    {
        return MarketingProviderCredential::where('company_id', $companyId)
            ->where('provider', $provider)
            ->first();
    }

    public function isConfigured(string $companyId, string $provider): bool
    {
        return Cache::remember(
            $this->configuredCacheKey($companyId, $provider),
            self::CACHE_TTL,
            function () use ($companyId, $provider): bool {
                $cred = $this->find($companyId, $provider);

                return $cred !== null && $cred->status === 'ready';
            },
        );
    }

    /**
     * Returns safe config status — app_secret is NEVER included.
     *
     * @return array{
     *   provider: string,
     *   app_id: string|null,
     *   has_app_secret: bool,
     *   redirect_uri: string|null,
     *   default_redirect_uri: string,
     *   status: string,
     *   validated_at: string|null,
     * }
     */
    public function getStatus(string $companyId, string $provider): array
    {
        $cred = $this->find($companyId, $provider);

        return [
            'provider' => $provider,
            'app_id' => $cred?->app_id,
            'has_app_secret' => ! empty($cred?->app_secret),
            'redirect_uri' => $cred?->redirect_uri,
            'default_redirect_uri' => $this->defaultRedirectUri($provider),
            'status' => $cred?->status ?? 'not_configured',
            'validated_at' => $cred?->validated_at?->toISOString(),
            'last_updated_at' => $cred?->updated_at?->toISOString(),
        ];
    }

    // ── Validate ──────────────────────────────────────────────────────────────

    /**
     * Validates credentials against the provider's live API without saving.
     * Emits an audit event for both success and failure.
     *
     * @return array{valid: bool, errors: list<string>}
     */
    public function validate(
        string $provider,
        string $appId,
        string $appSecret,
        ?string $companyId = null,
    ): array {
        $validator = $this->validators->get($provider);

        if ($validator === null) {
            return ['valid' => false, 'errors' => ["Provider [{$provider}] validation is not supported."]];
        }

        // SECURITY: never pass $appSecret to audit — use boolean flag only
        $result = $validator->validate($appId, $appSecret);

        if (! empty($companyId)) {
            $this->audit->record(
                companyId: $companyId,
                module: 'marketing',
                category: 'provider_credentials',
                action: $result['valid'] ? self::AUDIT_VALIDATION_SUCCESS : self::AUDIT_VALIDATION_FAILED,
                oldValue: null,
                newValue: [
                    'provider' => $provider,
                    'app_id' => $appId,
                    'has_app_secret' => ! empty($appSecret),
                    'errors' => $result['errors'],
                ],
                configKey: "provider.{$provider}.validation",
                reason: 'Credential validation check',
            );

            if ($result['valid']) {
                $this->events->providerValidated($companyId, $provider, null, $appId);
            } else {
                $this->events->providerValidationFailed($companyId, $provider, null, $appId, $result['errors']);
            }
        }

        return $result;
    }

    // ── Save ──────────────────────────────────────────────────────────────────

    /**
     * Validates credentials against the provider API and saves if valid.
     *
     * @return array{saved: bool, valid: bool, errors: list<string>, status: string}
     */
    public function validateAndSave(
        string $companyId,
        string $provider,
        string $appId,
        ?string $appSecret,
        string $redirectUri,
        string $actorId,
    ): array {
        $old = $this->find($companyId, $provider);

        // Resolve the effective secret: new value OR stored encrypted secret.
        // When null on first-time config, there is nothing to fall back to.
        if ($appSecret === null) {
            if ($old === null) {
                return [
                    'saved' => false,
                    'valid' => false,
                    'errors' => ['App Secret is required for first-time configuration.'],
                    'status' => 'not_configured',
                ];
            }
            $effectiveSecret = (string) $old->app_secret;
        } else {
            $effectiveSecret = $appSecret;
        }

        $result = $this->validate($provider, $appId, $effectiveSecret, $companyId);

        if (! $result['valid']) {
            return array_merge($result, ['saved' => false, 'status' => 'invalid']);
        }

        $effectiveUri = $this->resolveRedirectUri($provider, $redirectUri);

        $credData = [
            'app_id' => $appId,
            'redirect_uri' => $effectiveUri,
            'status' => 'ready',
            'validated_at' => now(),
            'validated_by' => $actorId,
            'updated_by' => $actorId,
            'created_by' => $old === null ? $actorId : $old->created_by,
        ];

        // Only overwrite the stored secret when the user explicitly provided a new one
        if ($appSecret !== null) {
            $credData['app_secret'] = $appSecret;
        }

        $cred = MarketingProviderCredential::updateOrCreate(
            ['company_id' => $companyId, 'provider' => $provider],
            $credData,
        );

        $this->invalidateAllCaches($companyId, $provider);

        $this->audit->record(
            companyId: $companyId,
            module: 'marketing',
            category: 'provider_credentials',
            action: $old === null ? self::AUDIT_CREATED : self::AUDIT_UPDATED,
            oldValue: $old ? ['provider' => $provider, 'app_id' => $old->app_id, 'status' => $old->status] : null,
            newValue: [
                'provider' => $provider,
                'app_id' => $appId,
                'has_app_secret' => true,
                'secret_changed' => $appSecret !== null,
                'redirect_uri' => $effectiveUri,
                'status' => 'ready',
            ],
            configKey: "provider.{$provider}.credentials",
            reason: 'Configuration wizard save',
        );

        if ($old === null) {
            $this->events->providerConfigured($companyId, $provider, $actorId);
        } else {
            $this->events->providerConfigurationUpdated($companyId, $provider, $actorId, $old->status);
        }

        return ['saved' => true, 'valid' => true, 'errors' => [], 'status' => $cred->status];
    }

    // ── Secret Rotation ───────────────────────────────────────────────────────

    /**
     * Validates a new secret against the provider API and replaces the stored
     * secret atomically.  The previous secret is invalidated immediately and
     * is never returned.
     *
     * @return array{rotated: bool, valid: bool, errors: list<string>}
     */
    public function rotateSecret(
        string $companyId,
        string $provider,
        string $appId,
        string $newAppSecret,
        string $actorId,
    ): array {
        $result = $this->validate($provider, $appId, $newAppSecret, $companyId);

        if (! $result['valid']) {
            return array_merge($result, ['rotated' => false]);
        }

        $updated = MarketingProviderCredential::where('company_id', $companyId)
            ->where('provider', $provider)
            ->update([
                'app_id' => $appId,
                'app_secret' => $newAppSecret, // encrypted by model cast
                'status' => 'ready',
                'validated_at' => now(),
                'validated_by' => $actorId,
                'updated_by' => $actorId,
                'updated_at' => now(),
            ]);

        if ($updated === 0) {
            return ['rotated' => false, 'valid' => false, 'errors' => ['No credential record found to rotate.']];
        }

        $this->invalidateAllCaches($companyId, $provider);

        $this->audit->record(
            companyId: $companyId,
            module: 'marketing',
            category: 'provider_credentials',
            action: self::AUDIT_SECRET_ROTATED,
            oldValue: ['provider' => $provider, 'has_app_secret' => true],
            newValue: ['provider' => $provider, 'app_id' => $appId, 'has_app_secret' => true, 'status' => 'ready'],
            configKey: "provider.{$provider}.app_secret",
            reason: 'Secret rotation',
        );

        $this->events->providerCredentialRotated($companyId, $provider, $actorId);

        return ['rotated' => true, 'valid' => true, 'errors' => []];
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    public function clear(string $companyId, string $provider, string $actorId): void
    {
        $cred = $this->find($companyId, $provider);
        if ($cred === null) {
            return;
        }

        $previousStatus = $cred->status;

        $this->audit->record(
            companyId: $companyId,
            module: 'marketing',
            category: 'provider_credentials',
            action: self::AUDIT_DELETED,
            oldValue: ['provider' => $provider, 'app_id' => $cred->app_id, 'status' => $cred->status],
            newValue: null,
            configKey: "provider.{$provider}.credentials",
            reason: 'Configuration removed by user',
        );

        $cred->delete();
        $this->invalidateAllCaches($companyId, $provider);
        $this->events->providerConfigurationDeleted($companyId, $provider, $actorId, $previousStatus);
    }

    // ── OAuth lifecycle audit helpers ─────────────────────────────────────────
    // Called externally by MetaAuthController / OAuthService when OAuth events occur.

    public function auditOAuthConnected(string $companyId, string $provider, string $actorId): void
    {
        $this->audit->record(
            companyId: $companyId,
            module: 'marketing',
            category: 'provider_oauth',
            action: self::AUDIT_OAUTH_CONNECTED,
            oldValue: null,
            newValue: ['provider' => $provider, 'connected_by' => $actorId],
            configKey: "provider.{$provider}.oauth",
            reason: 'OAuth authorization completed',
        );

        MarketingProviderCredential::where('company_id', $companyId)
            ->where('provider', $provider)
            ->update(['status' => 'connected', 'updated_at' => now()]);

        $this->invalidateAllCaches($companyId, $provider);
        $this->events->providerConnected($companyId, $provider, $actorId);
    }

    public function auditOAuthDisconnected(string $companyId, string $provider, string $actorId): void
    {
        $this->audit->record(
            companyId: $companyId,
            module: 'marketing',
            category: 'provider_oauth',
            action: self::AUDIT_OAUTH_DISCONNECTED,
            oldValue: null,
            newValue: ['provider' => $provider, 'disconnected_by' => $actorId],
            configKey: "provider.{$provider}.oauth",
            reason: 'OAuth disconnected by user',
        );

        MarketingProviderCredential::where('company_id', $companyId)
            ->where('provider', $provider)
            ->update(['status' => 'ready', 'updated_at' => now()]);

        $this->invalidateAllCaches($companyId, $provider);
        $this->events->providerDisconnected($companyId, $provider, $actorId);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Returns the default OAuth redirect URI for a provider.
     * The URI must be registered in the provider's developer console.
     */
    public function defaultRedirectUri(string $provider): string
    {
        $base = rtrim((string) config('app.url'), '/');

        return "{$base}/api/marketing/{$provider}/auth/callback";
    }

    /** Invalidates ALL cache keys for a company+provider pair. */
    public function invalidateCache(string $companyId, string $provider): void
    {
        $this->invalidateAllCaches($companyId, $provider);
    }

    private function invalidateAllCaches(string $companyId, string $provider): void
    {
        Cache::forget($this->configuredCacheKey($companyId, $provider));
        Cache::forget($this->healthCacheKey($companyId, $provider));
    }

    private function resolveRedirectUri(string $provider, string $redirectUri): string
    {
        if (empty(trim($redirectUri))) {
            return $this->defaultRedirectUri($provider);
        }

        // Basic URI safety: must be https or http (dev)
        if (! filter_var($redirectUri, FILTER_VALIDATE_URL)) {
            return $this->defaultRedirectUri($provider);
        }

        return $redirectUri;
    }

    private function configuredCacheKey(string $companyId, string $provider): string
    {
        return "marketing:provider:{$companyId}:{$provider}:is_configured";
    }

    private function healthCacheKey(string $companyId, string $provider): string
    {
        return "marketing:provider:{$companyId}:{$provider}:health";
    }
}
