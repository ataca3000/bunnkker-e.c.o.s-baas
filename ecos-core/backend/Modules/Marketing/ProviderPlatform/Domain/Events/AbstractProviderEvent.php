<?php

declare(strict_types=1);

namespace Modules\Marketing\ProviderPlatform\Domain\Events;

use Illuminate\Support\Str;

/**
 * Base class for all Marketing Provider Domain Events.
 *
 * Standard payload contract — every subclass carries all of these fields.
 *
 * SECURITY INVARIANT: Never include app_secret, access_token, refresh_token,
 * or any sensitive credential in $metadata or $payload.  These fields are
 * safe for logging, queueing, and cross-module consumption.
 */
abstract class AbstractProviderEvent
{
    public readonly string $eventId;

    public readonly string $occurredAt;

    /**
     * @param  string  $companyId  Company that owns this provider configuration
     * @param  string  $provider  Machine key, e.g. "meta", "google_ads"
     * @param  string  $providerType  Category, e.g. "social_platform", "advertising_platform"
     * @param  string|null  $triggeredBy  Actor user UUID, or null for system-initiated events
     * @param  string  $currentStatus  Status after the event
     * @param  string|null  $previousStatus  Status before the event, null for first-time events
     * @param  string|null  $correlationId  Trace correlation ID from the originating request
     * @param  string|null  $requestId  HTTP request ID, null for background events
     * @param  string  $environment  config('app.env') value
     * @param  array  $metadata  Safe, non-secret context (app_id, provider_type, etc.)
     * @param  array|null  $payload  Optional provider-specific extra data — must never contain secrets
     */
    public function __construct(
        public readonly string $companyId,
        public readonly string $provider,
        public readonly string $providerType,
        public readonly ?string $triggeredBy,
        public readonly string $currentStatus,
        public readonly ?string $previousStatus,
        public readonly ?string $correlationId,
        public readonly ?string $requestId,
        public readonly string $environment,
        public readonly array $metadata = [],
        public readonly ?array $payload = null,
    ) {
        $this->eventId = (string) Str::uuid();
        $this->occurredAt = now()->toISOString();
    }

    /** Dot-notated event name used as the routing key. */
    abstract public function eventName(): string;

    /** Safe serialization for audit logs and queue messages. */
    public function toArray(): array
    {
        return [
            'event_id' => $this->eventId,
            'event_name' => $this->eventName(),
            'occurred_at' => $this->occurredAt,
            'company_id' => $this->companyId,
            'provider' => $this->provider,
            'provider_type' => $this->providerType,
            'triggered_by' => $this->triggeredBy,
            'current_status' => $this->currentStatus,
            'previous_status' => $this->previousStatus,
            'correlation_id' => $this->correlationId,
            'request_id' => $this->requestId,
            'environment' => $this->environment,
            'metadata' => $this->metadata,
            'payload' => $this->payload,
        ];
    }
}
