<?php

declare(strict_types=1);

namespace Modules\Inventory\DomainEvents\Contracts;

use DateTimeImmutable;

/**
 * Marker interface for all Inventory Domain Events.
 *
 * Intentionally framework-independent: no Laravel imports, no Eloquent, no HTTP.
 * Implementing classes MUST be immutable (readonly properties only).
 *
 * Payload rules (per ADR-006):
 *   MUST contain  : UUIDs (string), scalars, value objects, DateTimeImmutable
 *   MUST NOT contain: Eloquent models, repositories, services, framework objects
 */
interface DomainEvent
{
    /** Globally-unique identifier for this event instance. */
    public function eventId(): string;

    /** Canonical event name in dot-notation, e.g. "inventory.stock.received". */
    public function eventName(): string;

    /** Wall-clock time when the business fact occurred (UTC). */
    public function occurredAt(): DateTimeImmutable;

    /**
     * Schema version for this event payload.
     * Must return 1 until a breaking payload change requires a new version.
     * ADR-006 §Event versioning.
     */
    public function eventVersion(): int;

    /**
     * Correlation ID that ties one business fact to every downstream operation:
     * Listener → ChannelSynchronizationService → InventorySyncJob → SyncLog → Adapter.
     * Equals eventId() for originating events; may be overridden for derived events.
     */
    public function correlationId(): string;

    /**
     * Serialisable payload for logging and future event-sourcing.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array;
}
