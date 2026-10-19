<?php

declare(strict_types=1);

namespace Modules\POS\Session\Domain\Events;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;

final readonly class SessionSuspended implements DomainEvent
{
    public function __construct(
        private string $eventId,
        private DateTimeImmutable $occurredAt,
        private string $correlationId,
        public string $sessionId,
        public string $terminalId,
        public string $cashierId,
    ) {}

    public static function now(
        string $sessionId,
        string $terminalId,
        string $cashierId,
    ): self {
        $id = self::generateUuid();

        return new self(
            eventId: $id,
            occurredAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
            correlationId: $id,
            sessionId: $sessionId,
            terminalId: $terminalId,
            cashierId: $cashierId,
        );
    }

    public function eventId(): string
    {
        return $this->eventId;
    }

    public function eventName(): string
    {
        return 'pos.session.suspended';
    }

    public function occurredAt(): DateTimeImmutable
    {
        return $this->occurredAt;
    }

    public function eventVersion(): int
    {
        return 1;
    }

    public function correlationId(): string
    {
        return $this->correlationId;
    }

    public function toArray(): array
    {
        return [
            'event_id' => $this->eventId,
            'event_name' => $this->eventName(),
            'occurred_at' => $this->occurredAt->format(DateTimeInterface::ATOM),
            'event_version' => $this->eventVersion(),
            'correlation_id' => $this->correlationId,
            'session_id' => $this->sessionId,
            'terminal_id' => $this->terminalId,
            'cashier_id' => $this->cashierId,
        ];
    }

    private static function generateUuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0F | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3F | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
