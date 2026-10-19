<?php

declare(strict_types=1);

namespace Modules\POS\Sale\Domain\Events;

use DateTimeImmutable;
use DateTimeZone;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;

final readonly class SaleCompleted implements DomainEvent
{
    public function __construct(
        private string $eventId,
        private DateTimeImmutable $occurredAt,
        public string $saleId,
        public string $receiptNumber,
        public string $totalAmount,
        public string $amountPaid,
        public string $changeGiven,
        public string $currency,
    ) {}

    public static function now(
        string $saleId,
        string $receiptNumber,
        string $totalAmount,
        string $amountPaid,
        string $changeGiven,
        string $currency,
    ): self {
        return new self(
            eventId: self::generateUuid(),
            occurredAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
            saleId: $saleId,
            receiptNumber: $receiptNumber,
            totalAmount: $totalAmount,
            amountPaid: $amountPaid,
            changeGiven: $changeGiven,
            currency: $currency,
        );
    }

    public function eventId(): string
    {
        return $this->eventId;
    }

    public function eventName(): string
    {
        return 'pos.sale.completed';
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
            'total_amount' => $this->totalAmount,
            'amount_paid' => $this->amountPaid,
            'change_given' => $this->changeGiven,
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
