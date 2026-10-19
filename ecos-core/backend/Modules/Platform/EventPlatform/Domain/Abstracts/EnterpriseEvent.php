<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Domain\Abstracts;

use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Support\Str;
use Modules\Inventory\DomainEvents\Contracts\DomainEvent;
use ReflectionClass;

/**
 * Base class for all future ECOS enterprise events.
 *
 * Every module MUST extend this for new events (post-PKG-17).
 * Legacy events that implement DomainEvent are bridged automatically by the platform.
 *
 * Required fields per ECOS Event Spec:
 *   eventId, eventName, version, occurredAt, correlationId, causationId,
 *   companyId, warehouseId, module, aggregateType, aggregateId, payload,
 *   metadata, retryCount, isReplay, traceId
 */
abstract class EnterpriseEvent implements DomainEvent
{
    public string $eventId;

    public string $version;

    public string $occurredAt;

    public string $correlationId;

    public ?string $causationId = null;

    public string $companyId;

    public ?string $warehouseId = null;

    public string $module;

    public string $aggregateType;

    public string $aggregateId;

    public array $payload = [];

    public array $metadata = [];

    public int $retryCount = 0;

    public bool $isReplay = false;

    public string $traceId;

    // ── Abstract declarations ─────────────────────────────────────────────────

    abstract public function getEventName(): string;

    abstract public function getVersion(): string;

    abstract public function getModule(): string;

    abstract public function getAggregateType(): string;

    // ── DomainEvent interface ─────────────────────────────────────────────────

    final public function eventId(): string
    {
        return $this->eventId;
    }

    final public function eventName(): string
    {
        return $this->getEventName();
    }

    final public function eventVersion(): int
    {
        return (int) explode('.', $this->getVersion())[0];
    }

    final public function occurredAt(): DateTimeImmutable
    {
        return new DateTimeImmutable($this->occurredAt, new DateTimeZone('UTC'));
    }

    final public function correlationId(): string
    {
        return $this->correlationId;
    }

    // ── toArray / fromArray ───────────────────────────────────────────────────

    public function toArray(): array
    {
        return [
            'event_id' => $this->eventId,
            'event_name' => $this->getEventName(),
            'version' => $this->version,
            'occurred_at' => $this->occurredAt,
            'correlation_id' => $this->correlationId,
            'causation_id' => $this->causationId,
            'company_id' => $this->companyId,
            'warehouse_id' => $this->warehouseId,
            'module' => $this->module,
            'aggregate_type' => $this->aggregateType,
            'aggregate_id' => $this->aggregateId,
            'payload' => $this->payload,
            'metadata' => $this->metadata,
            'retry_count' => $this->retryCount,
            'is_replay' => $this->isReplay,
            'trace_id' => $this->traceId,
        ];
    }

    /** Reconstitute an event from persisted data — bypasses the typed constructor. */
    public static function fromArray(array $data): static
    {
        $ref = new ReflectionClass(static::class);
        $instance = $ref->newInstanceWithoutConstructor();

        $instance->eventId = $data['event_id'];
        $instance->version = $data['version'];
        $instance->occurredAt = $data['occurred_at'];
        $instance->correlationId = $data['correlation_id'];
        $instance->causationId = $data['causation_id'] ?? null;
        $instance->companyId = $data['company_id'];
        $instance->warehouseId = $data['warehouse_id'] ?? null;
        $instance->module = $data['module'];
        $instance->aggregateType = $data['aggregate_type'];
        $instance->aggregateId = $data['aggregate_id'];
        $instance->payload = is_string($data['payload'])
            ? (json_decode($data['payload'], true) ?? [])
            : ($data['payload'] ?? []);
        $instance->metadata = is_string($data['metadata'])
            ? (json_decode($data['metadata'], true) ?? [])
            : ($data['metadata'] ?? []);
        $instance->retryCount = (int) ($data['retry_count'] ?? 0);
        $instance->isReplay = (bool) ($data['is_replay'] ?? false);
        $instance->traceId = $data['trace_id'];

        return $instance;
    }

    // ── Fluent modifiers (return clones for immutability) ─────────────────────

    public function withRetryCount(int $count): static
    {
        $clone = clone $this;
        $clone->retryCount = $count;

        return $clone;
    }

    public function asReplay(): static
    {
        $clone = clone $this;
        $clone->isReplay = true;

        return $clone;
    }

    public function withCausation(string $causationId): static
    {
        $clone = clone $this;
        $clone->causationId = $causationId;

        return $clone;
    }

    // ── Protected initialization helper ──────────────────────────────────────

    protected function initializeEventFields(
        string $companyId,
        string $aggregateId,
        array $payload = [],
        array $metadata = [],
        ?string $correlationId = null,
        ?string $causationId = null,
        ?string $warehouseId = null,
    ): void {
        $this->eventId = Str::uuid()->toString();
        $this->version = $this->getVersion();
        $this->occurredAt = now()->format('Y-m-d H:i:s');
        $this->correlationId = $correlationId ?? Str::uuid()->toString();
        $this->causationId = $causationId;
        $this->companyId = $companyId;
        $this->warehouseId = $warehouseId;
        $this->module = $this->getModule();
        $this->aggregateType = $this->getAggregateType();
        $this->aggregateId = $aggregateId;
        $this->payload = $payload;
        $this->metadata = $metadata;
        $this->retryCount = 0;
        $this->isReplay = false;
        $this->traceId = Str::uuid()->toString();
    }
}
