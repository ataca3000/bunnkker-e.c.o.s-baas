<?php

declare(strict_types=1);

namespace Modules\POS\Receipt\Domain\Events;

use DateTimeImmutable;
use DateTimeZone;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;

use const DATE_ATOM;

final class ReceiptIssued implements DomainEvent
{
    private string $eventId;

    private DateTimeImmutable $occurredAt;

    public function __construct(
        public readonly string $receiptId,
        public readonly string $receiptNumber,
        public readonly string $type,
        public readonly string $originalTransactionId,
        public readonly string $originalTransactionNumber,
        public readonly string $terminalId,
        public readonly string $cashierId,
        public readonly ?string $customerId,
        public readonly string $currency,
        public readonly string $totalAmount,
        public readonly int $lineCount,
        string $eventId,
        DateTimeImmutable $occurredAt,
    ) {
        $this->eventId = $eventId;
        $this->occurredAt = $occurredAt;
    }

    public static function now(
        string $receiptId,
        string $receiptNumber,
        string $type,
        string $originalTransactionId,
        string $originalTransactionNumber,
        string $terminalId,
        string $cashierId,
        ?string $customerId,
        string $currency,
        string $totalAmount,
        int $lineCount,
    ): self {
        return new self(
            receiptId: $receiptId,
            receiptNumber: $receiptNumber,
            type: $type,
            originalTransactionId: $originalTransactionId,
            originalTransactionNumber: $originalTransactionNumber,
            terminalId: $terminalId,
            cashierId: $cashierId,
            customerId: $customerId,
            currency: $currency,
            totalAmount: $totalAmount,
            lineCount: $lineCount,
            eventId: self::generateUuid(),
            occurredAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
        );
    }

    public function eventId(): string
    {
        return $this->eventId;
    }

    public function eventName(): string
    {
        return 'pos.receipt.issued';
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
            'receipt_id' => $this->receiptId,
            'receipt_number' => $this->receiptNumber,
            'type' => $this->type,
            'original_transaction_id' => $this->originalTransactionId,
            'original_transaction_number' => $this->originalTransactionNumber,
            'terminal_id' => $this->terminalId,
            'cashier_id' => $this->cashierId,
            'customer_id' => $this->customerId,
            'currency' => $this->currency,
            'total_amount' => $this->totalAmount,
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
