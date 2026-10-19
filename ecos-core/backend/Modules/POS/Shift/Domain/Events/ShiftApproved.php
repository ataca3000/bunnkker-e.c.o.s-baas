<?php

declare(strict_types=1);

namespace Modules\POS\Shift\Domain\Events;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;

final readonly class ShiftApproved implements DomainEvent
{
    public function __construct(
        private string $eventId,
        private DateTimeImmutable $occurredAt,
        private string $correlationId,
        public string $shiftId,
        public string $sessionId,
        public string $terminalId,
        public string $cashierId,
        public int $shiftNumber,
        public string $closingCountAmount,
        public string $expectedClosingAmount,
        public string $varianceAmount,
        public string $currency,
        public int $durationMinutes,
    ) {}

    public static function now(
        string $shiftId,
        string $sessionId,
        string $terminalId,
        string $cashierId,
        int $shiftNumber,
        string $closingCountAmount,
        string $expectedClosingAmount,
        string $varianceAmount,
        string $currency,
        int $durationMinutes,
    ): self {
        $id = self::generateUuid();

        return new self(
            eventId: $id,
            occurredAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
            correlationId: $id,
            shiftId: $shiftId,
            sessionId: $sessionId,
            terminalId: $terminalId,
            cashierId: $cashierId,
            shiftNumber: $shiftNumber,
            closingCountAmount: $closingCountAmount,
            expectedClosingAmount: $expectedClosingAmount,
            varianceAmount: $varianceAmount,
            currency: $currency,
            durationMinutes: $durationMinutes,
        );
    }

    public function eventId(): string
    {
        return $this->eventId;
    }

    public function eventName(): string
    {
        return 'pos.shift.approved';
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
            'shift_id' => $this->shiftId,
            'session_id' => $this->sessionId,
            'terminal_id' => $this->terminalId,
            'cashier_id' => $this->cashierId,
            'shift_number' => $this->shiftNumber,
            'closing_count_amount' => $this->closingCountAmount,
            'expected_closing_amount' => $this->expectedClosingAmount,
            'variance_amount' => $this->varianceAmount,
            'currency' => $this->currency,
            'duration_minutes' => $this->durationMinutes,
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
