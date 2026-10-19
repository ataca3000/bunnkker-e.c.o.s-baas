<?php

declare(strict_types=1);

namespace Modules\POS\Sale\Domain\Events;

use DateTimeImmutable;
use DateTimeZone;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;

final readonly class SaleRecorded implements DomainEvent
{
    public function __construct(
        private string $eventId,
        private DateTimeImmutable $occurredAt,
        public string $saleId,
        public string $cartId,
        public string $paymentId,
        public string $sessionId,
        public string $shiftId,
        public string $terminalId,
        public string $cashierId,
        public ?string $customerId,
        public string $receiptNumber,
        public string $totalAmount,
        public string $amountPaid,
        public string $currency,
        public int $lineCount,
    ) {}

    public static function now(
        string $saleId,
        string $cartId,
        string $paymentId,
        string $sessionId,
        string $shiftId,
        string $terminalId,
        string $cashierId,
        ?string $customerId,
        string $receiptNumber,
        string $totalAmount,
        string $amountPaid,
        string $currency,
        int $lineCount,
    ): self {
        return new self(
            eventId: self::generateUuid(),
            occurredAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
            saleId: $saleId,
            cartId: $cartId,
            paymentId: $paymentId,
            sessionId: $sessionId,
            shiftId: $shiftId,
            terminalId: $terminalId,
            cashierId: $cashierId,
            customerId: $customerId,
            receiptNumber: $receiptNumber,
            totalAmount: $totalAmount,
            amountPaid: $amountPaid,
            currency: $currency,
            lineCount: $lineCount,
        );
    }

    public function eventId(): string
    {
        return $this->eventId;
    }

    public function eventName(): string
    {
        return 'pos.sale.recorded';
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
            'cart_id' => $this->cartId,
            'payment_id' => $this->paymentId,
            'session_id' => $this->sessionId,
            'shift_id' => $this->shiftId,
            'terminal_id' => $this->terminalId,
            'cashier_id' => $this->cashierId,
            'customer_id' => $this->customerId,
            'receipt_number' => $this->receiptNumber,
            'total_amount' => $this->totalAmount,
            'amount_paid' => $this->amountPaid,
            'currency' => $this->currency,
            'line_count' => $this->lineCount,
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
