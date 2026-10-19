<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Application\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Collects and exposes provider-level operational metrics.
 *
 * Metrics are accumulated in Redis counters (fast write path) and
 * periodically queryable via DB for the Monitoring OS.
 *
 * Counters tracked per company+provider:
 *   oauth_success_count, oauth_failure_count
 *   validation_success_count, validation_failure_count
 *   config_change_count
 *   sync_success_count, sync_failure_count
 *   health_change_count
 *   token_expiry_count
 *   webhook_failure_count
 *   api_error_count
 */
final class ProviderMetricsCollector
{
    private const PREFIX = 'provider_metrics';

    private const TTL = 86_400; // 24 hours

    // ── Increment ─────────────────────────────────────────────────────────────

    public function increment(string $companyId, string $provider, string $metric): void
    {
        $key = $this->key($companyId, $provider, $metric);
        Cache::increment($key);
        Cache::put($key.':updated_at', now()->toISOString(), self::TTL);
    }

    // ── Convenience methods ───────────────────────────────────────────────────

    public function recordOAuthSuccess(string $companyId, string $provider): void
    {
        $this->increment($companyId, $provider, 'oauth_success_count');
    }

    public function recordOAuthFailure(string $companyId, string $provider): void
    {
        $this->increment($companyId, $provider, 'oauth_failure_count');
    }

    public function recordValidationSuccess(string $companyId, string $provider): void
    {
        $this->increment($companyId, $provider, 'validation_success_count');
    }

    public function recordValidationFailure(string $companyId, string $provider): void
    {
        $this->increment($companyId, $provider, 'validation_failure_count');
    }

    public function recordConfigChange(string $companyId, string $provider): void
    {
        $this->increment($companyId, $provider, 'config_change_count');
    }

    public function recordSyncSuccess(string $companyId, string $provider): void
    {
        $this->increment($companyId, $provider, 'sync_success_count');
    }

    public function recordSyncFailure(string $companyId, string $provider): void
    {
        $this->increment($companyId, $provider, 'sync_failure_count');
    }

    public function recordHealthChange(string $companyId, string $provider): void
    {
        $this->increment($companyId, $provider, 'health_change_count');
    }

    public function recordTokenExpiry(string $companyId, string $provider): void
    {
        $this->increment($companyId, $provider, 'token_expiry_count');
    }

    public function recordApiError(string $companyId, string $provider): void
    {
        $this->increment($companyId, $provider, 'api_error_count');
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    /**
     * Returns current metrics snapshot for a company+provider pair.
     *
     * @return array<string, int>
     */
    public function getMetrics(string $companyId, string $provider): array
    {
        $counters = [
            'oauth_success_count',
            'oauth_failure_count',
            'validation_success_count',
            'validation_failure_count',
            'config_change_count',
            'sync_success_count',
            'sync_failure_count',
            'health_change_count',
            'token_expiry_count',
            'api_error_count',
        ];

        $result = [];
        foreach ($counters as $counter) {
            $result[$counter] = (int) (Cache::get($this->key($companyId, $provider, $counter)) ?? 0);
        }

        return $result;
    }

    /**
     * Returns event counts from the persistent events table (last N days).
     *
     * @return array<string, int> event_name => count
     */
    public function getEventCounts(string $companyId, string $provider, int $days = 30): array
    {
        return DB::table('marketing_provider_events')
            ->where('company_id', $companyId)
            ->where('provider', $provider)
            ->where('occurred_at', '>=', now()->subDays($days)->toISOString())
            ->selectRaw('event_name, COUNT(*) as count')
            ->groupBy('event_name')
            ->orderBy('count', 'desc')
            ->pluck('count', 'event_name')
            ->toArray();
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private function key(string $companyId, string $provider, string $metric): string
    {
        return self::PREFIX.":{$companyId}:{$provider}:{$metric}";
    }
}
