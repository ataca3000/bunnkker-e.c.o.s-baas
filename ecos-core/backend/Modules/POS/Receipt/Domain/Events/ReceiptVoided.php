<?php

declare(strict_types=1);

namespace Modules\POS\Receipt\Domain\Events;

use DateTimeImmutable;
use DateTimeZone;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;

use const DATE_ATOM;

final class ReceiptVoided implements DomainEvent
{
    private string $eventId;

    private DateTimeImmutable $occurredAt;

    public function __construct(
        public readonly string $receiptId,
        public readonly string $receiptNumber,
        public readonly string $voidedBy,
        public readonly string $voidReason,
        string $eventId,
        DateTimeImmutable $occurredAt,
    ) {
        $this->eventId = $eventId;
        $this->occurredAt = $occurredAt;
    }

    public static function now(
        string $receiptId,
        string $receiptNumber,
        string $voidedBy,
        string $voidReason,
    ): self {
        return new self(
            receiptId: $receiptId,
            receiptNumber: $receiptNumber,
            voidedBy: $voidedBy,
            voidReason: $voidReason,
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
        return 'pos.receipt.voided';
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
            'voided_by' => $this->voidedBy,
            'void_reason' => $this->voidReason,
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
