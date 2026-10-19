<?php

declare(strict_types=1);

namespace Modules\Marketing\Connections\Domain\ValueObjects;

/**
 * Immutable snapshot of a connector's health at a point in time.
 *
 * Produced by MarketingConnectorInterface::checkConnectorHealth()
 * and surfaced in the Connector Health Dashboard.
 */
final readonly class ConnectorHealthData
{
    public function __construct(
        public string $connectionStatus,
        public string $authStatus,          // 'valid' | 'expired' | 'missing' | 'unknown'
        public ?string $tokenExpiresAt,
        public bool $apiAvailable,
        public ?int $rateLimitRemaining,
        public ?string $rateLimitResetAt,
        public ?int $avgSyncDurationSeconds,
        public ?string $lastSuccessfulSyncAt,
        public ?string $lastFailedSyncAt,
        public int $errorCount = 0,
        public int $retryQueueSize = 0,
        public array $rawMeta = [],  // connector-specific extra info
    ) {}

    public function isHealthy(): bool
    {
        return $this->apiAvailable
            && $this->authStatus === 'valid'
            && $this->errorCount === 0;
    }

    public function requiresAction(): bool
    {
        return ! $this->apiAvailable
            || in_array($this->authStatus, ['expired', 'missing'], true)
            || $this->errorCount > 5;
    }

    public function overallStatus(): string
    {
        if ($this->requiresAction()) {
            return 'error';
        }

        if ($this->errorCount > 0 || ($this->rateLimitRemaining !== null && $this->rateLimitRemaining < 10)) {
            return 'warning';
        }

        return 'healthy';
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'connection_status' => $this->connectionStatus,
            'auth_status' => $this->authStatus,
            'token_expires_at' => $this->tokenExpiresAt,
            'api_available' => $this->apiAvailable,
            'rate_limit_remaining' => $this->rateLimitRemaining,
            'rate_limit_reset_at' => $this->rateLimitResetAt,
            'avg_sync_duration_seconds' => $this->avgSyncDurationSeconds,
            'last_successful_sync_at' => $this->lastSuccessfulSyncAt,
            'last_failed_sync_at' => $this->lastFailedSyncAt,
            'error_count' => $this->errorCount,
            'retry_queue_size' => $this->retryQueueSize,
            'overall_status' => $this->overallStatus(),
            'meta' => $this->rawMeta,
        ];
    }

    public static function unavailable(string $reason): self
    {
        return new self(
            connectionStatus: 'error',
            authStatus: 'unknown',
            tokenExpiresAt: null,
            apiAvailable: false,
            rateLimitRemaining: null,
            rateLimitResetAt: null,
            avgSyncDurationSeconds: null,
            lastSuccessfulSyncAt: null,
            lastFailedSyncAt: now()->toIso8601String(),
            errorCount: 1,
            retryQueueSize: 0,
            rawMeta: ['reason' => $reason],
        );
    }
}
