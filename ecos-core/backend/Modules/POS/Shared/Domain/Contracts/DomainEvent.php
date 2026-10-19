<?php

declare(strict_types=1);

namespace Modules\POS\Shared\Domain\Contracts;

use DateTimeImmutable;

/**
 * Marker contract for all POS domain events.
 *
 * Framework-independent — no Laravel imports, no Eloquent, no HTTP.
 * All implementing classes MUST be immutable (readonly properties only).
 *
 * Payload rules:
 *   MUST contain  : UUIDs (string), scalars, value objects, DateTimeImmutable
 *   MUST NOT contain: Eloquent models, repositories, services, framework objects
 *
 * Event name convention: "pos.{aggregate}.{fact}" e.g. "pos.session.opened"
 */
interface DomainEvent
{
    /** Globally-unique identifier for this event instance. */
    public function eventId(): string;

    /** Canonical event name, e.g. "pos.session.opened". */
    public function eventName(): string;

    /** Wall-clock time when the business fact occurred (UTC). */
    public function occurredAt(): DateTimeImmutable;

    /** Schema version. Must return 1 until a breaking payload change requires a new version. */
    public function eventVersion(): int;

    /**
     * Correlation ID tying one business fact to all downstream operations.
     * Equals eventId() for originating events.
     */
    public function correlationId(): string;

    /** @return array<string, mixed> */
    public function toArray(): array;
}
