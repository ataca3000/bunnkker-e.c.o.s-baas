<?php

declare(strict_types=1);

namespace Modules\POS\Payment\Domain\Events;

use DateTimeImmutable;
use DateTimeZone;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;

final readonly class TenderRemoved implements DomainEvent
{
    public function __construct(
        private string $eventId,
        private DateTimeImmutable $occurredAt,
        public string $paymentId,
        public string $cartId,
        public string $tenderId,
        public string $type,
        public string $amountTenderedTotal,
    ) {}

    public static function now(
        string $paymentId,
        string $cartId,
        string $tenderId,
        string $type,
        string $amountTenderedTotal,
    ): self {
        return new self(
            eventId: self::generateUuid(),
            occurredAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
            paymentId: $paymentId,
            cartId: $cartId,
            tenderId: $tenderId,
            type: $type,
            amountTenderedTotal: $amountTenderedTotal,
        );
    }

    public function eventId(): string
    {
        return $this->eventId;
    }

    public function eventName(): string
    {
        return 'pos.payment.tender_removed';
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
            'payment_id' => $this->paymentId,
            'cart_id' => $this->cartId,
            'tender_id' => $this->tenderId,
            'type' => $this->type,
            'amount_tendered_total' => $this->amountTenderedTotal,
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
