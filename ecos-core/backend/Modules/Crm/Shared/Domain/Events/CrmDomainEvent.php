<?php

declare(strict_types=1);

namespace Modules\Crm\Shared\Domain\Events;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use Illuminate\Foundation\Events\Dispatchable;
use Modules\Inventory\DomainEvents\Contracts\DomainEvent;

/**
 * Base for every CRM enterprise domain event.
 *
 * ┌─ WHY A BASE, AND WHY THIS CONTRACT ─────────────────────────────────────┐
 * │ CRM published nothing, so Finance's loyalty posting rules never fired,   │
 * │ notifications could not react, and nothing downstream could subscribe.   │
 * │ This closes that gap without adding a second event system.               │
 * │                                                                          │
 * │ It implements the SAME contract the rest of the platform already uses —  │
 * │ the one Operations' 22 events implement and that EnterpriseEventBus      │
 * │ accepts — and dispatches through Laravel like they do. The enterprise    │
 * │ bus receives it by the existing bridge in EventPlatformServiceProvider.  │
 * │ No new dispatcher, no parallel transport, nothing for a subscriber to    │
 * │ learn.                                                                   │
 * │                                                                          │
 * │ The contract lives under Inventory for historical reasons; it functions  │
 * │ as the platform's. Following it is what keeps CRM on the one transport.  │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * RELIABILITY. eventId is generated once at construction and never changes, so
 * a redelivered or replayed event carries the same identity and a consumer can
 * dedupe on it — that is what makes these safe to queue and retry. occurredAt is
 * stamped at construction rather than at handling, so the event states when the
 * business fact happened, not when someone got round to reading it.
 *
 * AUTHORITATIVE DATA ONLY. Subclasses carry ids and values CRM already owns.
 * They never load another context to enrich a payload — a consumer that needs
 * more asks its own owner, which is what keeps this from becoming a coupling.
 */
abstract class CrmDomainEvent implements DomainEvent
{
    use Dispatchable;

    private readonly string $eventId;

    private readonly DateTimeImmutable $occurredAtUtc;

    public function __construct()
    {
        $this->eventId = self::generateUuid();
        $this->occurredAtUtc = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    }

    /** The dot-notation name subscribers bind to. */
    abstract public function eventName(): string;

    /**
     * The facts this event carries, beyond the envelope.
     *
     * @return array<string, mixed>
     */
    abstract protected function payload(): array;

    final public function eventId(): string
    {
        return $this->eventId;
    }

    public function eventVersion(): int
    {
        return 1;
    }

    /**
     * Defaults to the event's own id.
     *
     * A workflow that spans several events may override this so they can be
     * traced together; nothing here invents a correlation that the caller has
     * not established.
     */
    public function correlationId(): string
    {
        return $this->eventId;
    }

    final public function occurredAt(): DateTimeImmutable
    {
        return $this->occurredAtUtc;
    }

    /**
     * Envelope plus payload, in the shape every other platform event uses.
     *
     * @return array<string, mixed>
     */
    final public function toArray(): array
    {
        return [
            'event_id' => $this->eventId,
            'event_name' => $this->eventName(),
            'version' => $this->eventVersion(),
            'correlation_id' => $this->correlationId(),
            'occurred_at' => $this->occurredAtUtc->format(DateTimeInterface::ATOM),
        ] + $this->payload();
    }

    private static function generateUuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80);

        return implode('-', [
            bin2hex(substr($bytes, 0, 4)),
            bin2hex(substr($bytes, 4, 2)),
            bin2hex(substr($bytes, 6, 2)),
            bin2hex(substr($bytes, 8, 2)),
            bin2hex(substr($bytes, 10, 6)),
        ]);
    }
}
