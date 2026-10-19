<?php

declare(strict_types=1);

namespace Modules\POS\Exchange\Domain\Events;

use DateTimeImmutable;
use DateTimeZone;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;

final readonly class ExchangeConfirmed implements DomainEvent
{
    public function __construct(
        private string $eventId,
        private DateTimeImmutable $occurredAt,
        public string $exchangeId,
        public string $exchangeNumber,
        public string $returnedTotalAmount,
        public string $replacementTotalAmount,
        public string $currency,
    ) {}

    public static function now(
        string $exchangeId,
        string $exchangeNumber,
        string $returnedTotalAmount,
        string $replacementTotalAmount,
        string $currency,
    ): self {
        return new self(
            eventId: self::generateUuid(),
            occurredAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
            exchangeId: $exchangeId,
            exchangeNumber: $exchangeNumber,
            returnedTotalAmount: $returnedTotalAmount,
            replacementTotalAmount: $replacementTotalAmount,
            currency: $currency,
        );
    }

    public function eventId(): string
    {
        return $this->eventId;
    }

    public function eventName(): string
    {
        return 'pos.exchange.confirmed';
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
            'exchange_id' => $this->exchangeId,
            'exchange_number' => $this->exchangeNumber,
            'returned_total_amount' => $this->returnedTotalAmount,
            'replacement_total_amount' => $this->replacementTotalAmount,
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
