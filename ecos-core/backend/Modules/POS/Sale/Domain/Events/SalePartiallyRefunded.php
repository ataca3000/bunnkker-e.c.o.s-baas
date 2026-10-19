<?php

declare(strict_types=1);

namespace Modules\POS\Sale\Domain\Events;

use DateTimeImmutable;
use DateTimeZone;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;

final readonly class SalePartiallyRefunded implements DomainEvent
{
    public function __construct(
        private string $eventId,
        private DateTimeImmutable $occurredAt,
        public string $saleId,
        public string $receiptNumber,
    ) {}

    public static function now(
        string $saleId,
        string $receiptNumber,
    ): self {
        return new self(
            eventId: self::generateUuid(),
            occurredAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
            saleId: $saleId,
            receiptNumber: $receiptNumber,
        );
    }

    public function eventId(): string
    {
        return $this->eventId;
    }

    public function eventName(): string
    {
        return 'pos.sale.partially_refunded';
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
            'sale_id' => $this->saleId,
            'receipt_number' => $this->receiptNumber,
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
