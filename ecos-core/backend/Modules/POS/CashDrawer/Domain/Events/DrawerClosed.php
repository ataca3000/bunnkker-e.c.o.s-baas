<?php

declare(strict_types=1);

namespace Modules\POS\CashDrawer\Domain\Events;

use DateTimeImmutable;
use DateTimeZone;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;

final readonly class DrawerClosed implements DomainEvent
{
    public function __construct(
        private string $eventId,
        private DateTimeImmutable $occurredAt,
        public string $drawerId,
        public string $shiftId,
        public string $terminalId,
        public string $openingFloat,
        public string $expectedBalance,
        public string $closingCount,
        public string $variance,
        public string $currency,
    ) {}

    public static function now(
        string $drawerId,
        string $shiftId,
        string $terminalId,
        string $openingFloat,
        string $expectedBalance,
        string $closingCount,
        string $variance,
        string $currency,
    ): self {
        return new self(
            eventId: self::generateUuid(),
            occurredAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
            drawerId: $drawerId,
            shiftId: $shiftId,
            terminalId: $terminalId,
            openingFloat: $openingFloat,
            expectedBalance: $expectedBalance,
            closingCount: $closingCount,
            variance: $variance,
            currency: $currency,
        );
    }

    public function eventId(): string
    {
        return $this->eventId;
    }

    public function eventName(): string
    {
        return 'pos.drawer.closed';
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
            'shift_id' => $this->shiftId,
            'terminal_id' => $this->terminalId,
            'opening_float' => $this->openingFloat,
            'expected_balance' => $this->expectedBalance,
            'closing_count' => $this->closingCount,
            'variance' => $this->variance,
            'currency' => $this->currency,
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
