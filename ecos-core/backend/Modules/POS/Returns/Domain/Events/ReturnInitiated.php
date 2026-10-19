<?php

declare(strict_types=1);

namespace Modules\POS\Returns\Domain\Events;

use DateTimeImmutable;
use DateTimeZone;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;

final readonly class ReturnInitiated implements DomainEvent
{
    public function __construct(
        private string $eventId,
        private DateTimeImmutable $occurredAt,
        public string $returnId,
        public string $saleId,
        public string $originalReceiptNumber,
        public string $returnNumber,
        public string $sessionId,
        public string $shiftId,
        public string $terminalId,
        public string $cashierId,
        public ?string $customerId,
        public string $currency,
        public string $refundTotal,
        public string $refundMethod,
        public int $lineCount,
    ) {}

    public static function now(
        string $returnId,
        string $saleId,
        string $originalReceiptNumber,
        string $returnNumber,
        string $sessionId,
        string $shiftId,
        string $terminalId,
        string $cashierId,
        ?string $customerId,
        string $currency,
        string $refundTotal,
        string $refundMethod,
        int $lineCount,
    ): self {
        return new self(
            eventId: self::generateUuid(),
            occurredAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
            returnId: $returnId,
            saleId: $saleId,
            originalReceiptNumber: $originalReceiptNumber,
            returnNumber: $returnNumber,
            sessionId: $sessionId,
            shiftId: $shiftId,
            terminalId: $terminalId,
            cashierId: $cashierId,
            customerId: $customerId,
            currency: $currency,
            refundTotal: $refundTotal,
            refundMethod: $refundMethod,
            lineCount: $lineCount,
        );
    }

    public function eventId(): string
    {
        return $this->eventId;
    }

    public function eventName(): string
    {
        return 'pos.return.initiated';
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
            'return_id' => $this->returnId,
            'sale_id' => $this->saleId,
            'original_receipt_number' => $this->originalReceiptNumber,
            'return_number' => $this->returnNumber,
            'session_id' => $this->sessionId,
            'shift_id' => $this->shiftId,
            'terminal_id' => $this->terminalId,
            'cashier_id' => $this->cashierId,
            'customer_id' => $this->customerId,
            'currency' => $this->currency,
            'refund_total' => $this->refundTotal,
            'refund_method' => $this->refundMethod,
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
