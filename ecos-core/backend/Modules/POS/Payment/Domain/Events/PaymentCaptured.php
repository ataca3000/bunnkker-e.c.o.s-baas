<?php

declare(strict_types=1);

namespace Modules\POS\Payment\Domain\Events;

use DateTimeImmutable;
use DateTimeZone;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;

final readonly class PaymentCaptured implements DomainEvent
{
    public function __construct(
        private string $eventId,
        private DateTimeImmutable $occurredAt,
        public string $paymentId,
        public string $cartId,
        public string $sessionId,
        public string $terminalId,
        public string $cashierId,
        public string $cartTotalAmount,
        public string $amountTenderedAmount,
        public string $changeDueAmount,
        public string $currency,
        public int $tenderCount,
    ) {}

    public static function now(
        string $paymentId,
        string $cartId,
        string $sessionId,
        string $terminalId,
        string $cashierId,
        string $cartTotalAmount,
        string $amountTenderedAmount,
        string $changeDueAmount,
        string $currency,
        int $tenderCount,
    ): self {
        return new self(
            eventId: self::generateUuid(),
            occurredAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
            paymentId: $paymentId,
            cartId: $cartId,
            sessionId: $sessionId,
            terminalId: $terminalId,
            cashierId: $cashierId,
            cartTotalAmount: $cartTotalAmount,
            amountTenderedAmount: $amountTenderedAmount,
            changeDueAmount: $changeDueAmount,
            currency: $currency,
            tenderCount: $tenderCount,
        );
    }

    public function eventId(): string
    {
        return $this->eventId;
    }

    public function eventName(): string
    {
        return 'pos.payment.captured';
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
            'session_id' => $this->sessionId,
            'terminal_id' => $this->terminalId,
            'cashier_id' => $this->cashierId,
            'cart_total_amount' => $this->cartTotalAmount,
            'amount_tendered_amount' => $this->amountTenderedAmount,
            'change_due_amount' => $this->changeDueAmount,
            'currency' => $this->currency,
            'tender_count' => $this->tenderCount,
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
