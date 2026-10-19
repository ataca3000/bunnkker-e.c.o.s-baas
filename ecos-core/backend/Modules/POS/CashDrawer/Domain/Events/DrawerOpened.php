<?php

declare(strict_types=1);

namespace Modules\POS\CashDrawer\Domain\Events;

use DateTimeImmutable;
use DateTimeZone;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;

final readonly class DrawerOpened implements DomainEvent
{
    public function __construct(
        private string $eventId,
        private DateTimeImmutable $occurredAt,
        public string $drawerId,
        public string $terminalId,
        public string $sessionId,
        public string $shiftId,
        public string $cashierId,
        public string $currency,
        public string $openingFloat,
    ) {}

    public static function now(
        string $drawerId,
        string $terminalId,
        string $sessionId,
        string $shiftId,
        string $cashierId,
        string $currency,
        string $openingFloat,
    ): self {
        return new self(
            eventId: self::generateUuid(),
            occurredAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
            drawerId: $drawerId,
            terminalId: $terminalId,
            sessionId: $sessionId,
            shiftId: $shiftId,
            cashierId: $cashierId,
            currency: $currency,
            openingFloat: $openingFloat,
        );
    }

    public function eventId(): string
    {
        return $this->eventId;
    }

    public function eventName(): string
    {
        return 'pos.drawer.opened';
    }

    public function eventVersion(): int
    {
        return 1;
    }

    public function occurredAt(): DateTimeImmutable
    {
        return $this->occurredAt;
    }

    public function correlationId(): string
    {
        return $this->eventId;
    }

    public function toArray(): array
    {
        return [
            'event_id' => $this->eventId,
            'event_name' => $this->eventName(),
            'occurred_at' => $this->occurredAt->format(DATE_ATOM),
            'event_version' => $this->eventVersion(),
            'correlation_id' => $this->correlationId(),
            'drawer_id' => $this->drawerId,
            'terminal_id' => $this->terminalId,
            'session_id' => $this->sessionId,
            'shift_id' => $this->shiftId,
            'cashier_id' => $this->cashierId,
            'currency' => $this->currency,
            'opening_float' => $this->openingFloat,
        ];
    }

    private static function generateUuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
