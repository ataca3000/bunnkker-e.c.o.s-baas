<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderConfig\Application\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Modules\Admin\Configuration\Domain\Services\ConfigAuditService;
use Modules\Marketing\ProviderPlatform\Application\Services\ProviderEventPublisher;
use Throwable;

/**
 * Actively checks health of a provider's credentials and connection.
 *
 * Status matrix:
 *   not_configured      — no credential record exists
 *   invalid_configuration — app_id / app_secret fail live API validation
 *   service_unavailable — provider API cannot be reached (network or HTTP 5xx)
 *   ready               — credentials valid, OAuth not yet initiated
 *   connected           — OAuth token present and valid
 *   token_expired       — OAuth access token expired or revoked
 *   permission_error    — connected but missing required scopes
 *   webhook_missing     — connected but webhook subscription not registered
 *   sync_disabled       — integration paused by user
 *   unknown             — unexpected error during health check
 *
 * Health results are cached for CACHE_TTL seconds.  Call invalidate() before
 * a forced re-check (e.g. after saving new credentials).
 */
final class ProviderHealthMonitor
{
    private const CACHE_TTL = 600; // 10 minutes

    public function __construct(
        private readonly ProviderCredentialService $credentials,
        private readonly ConfigAuditService $audit,
        private readonly ProviderEventPublisher $events,
    ) {}

    /**
     * Runs all applicable checks and returns a health report.
     * Persists updated status to the credential record when it changes.
     *
     * @return array{
     *   status: string,
     *   checks: array<string, bool|null>,
     *   checked_at: string,
     * }
     */
    public function check(string $companyId, string $provider): array
    {
        return Cache::remember(
            $this->cacheKey($companyId, $provider),
            self::CACHE_TTL,
            fn () => $this->runChecks($companyId, $provider),
        );
    }

    /** Forces the next call to check() to bypass the cache. */
    public function invalidate(string $companyId, string $provider): void
    {
        Cache::forget($this->cacheKey($companyId, $provider));
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private function runChecks(string $companyId, string $provider): array
    {
        $checks = [
            'config_exists' => false,
            'credentials_valid' => null,
            'service_reachable' => null,
        ];

        $cred = $this->credentials->find($companyId, $provider);
        if ($cred === null) {
            return $this->finalize('not_configured', $checks, $companyId, $provider, null);
        }

        $checks['config_exists'] = true;

        if (empty($cred->app_id) || empty($cred->app_secret)) {
            return $this->finalize('invalid_configuration', $checks, $companyId, $provider, $cred->status);
        }

        try {
            $result = $this->credentials->validate($provider, (string) $cred->app_id, (string) $cred->app_secret);

            $checks['service_reachable'] = true;
            $checks['credentials_valid'] = $result['valid'];

            if (! $result['valid']) {
                return $this->finalize('invalid_configuration', $checks, $companyId, $provider, $cred->status);
            }
        } catch (Throwable) {
            $checks['service_reachable'] = false;

            return $this->finalize('service_unavailable', $checks, $companyId, $provider, $cred->status);
        }

        // Credentials are valid. Preserve existing OAuth-layer status (connected,
        // token_expired, etc.) instead of downgrading to "ready".
        $preserve = ['ready', 'connected', 'token_expired', 'permission_error', 'webhook_missing', 'sync_disabled'];
        $status = in_array($cred->status, $preserve, true) ? $cred->status : 'ready';

        return $this->finalize($status, $checks, $companyId, $provider, $cred->status);
    }

    private function finalize(
        string $newStatus,
        array $checks,
        string $companyId,
        string $provider,
        ?string $oldStatus,
    ): array {
        if ($oldStatus !== null && $newStatus !== $oldStatus) {
            DB::table('marketing_provider_credentials')
                ->where('company_id', $companyId)
                ->where('provider', $provider)
                ->update(['status' => $newStatus, 'updated_at' => now()]);

            $this->credentials->invalidateCache($companyId, $provider);

            $this->audit->record(
                companyId: $companyId,
                module: 'marketing',
                category: 'provider_health',
                action: 'health_status_changed',
                oldValue: ['status' => $oldStatus],
                newValue: ['provider' => $provider, 'status' => $newStatus],
                configKey: "provider.{$provider}.health_status",
                reason: 'Automated health check',
            );

            $this->events->providerHealthChanged($companyId, $provider, $newStatus, $oldStatus, $checks);
        }

        return [
            'status' => $newStatus,
            'checks' => $checks,
            'checked_at' => now()->toISOString(),
        ];
    }

    private function cacheKey(string $companyId, string $provider): string
    {
        return "marketing:provider:{$companyId}:{$provider}:health";
    }
}
