<?php

declare(strict_types=1);

namespace Modules\POS\Exchange\Domain\Events;

use DateTimeImmutable;
use DateTimeZone;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;

final readonly class ExchangeInitiated implements DomainEvent
{
    public function __construct(
        private string $eventId,
        private DateTimeImmutable $occurredAt,
        public string $exchangeId,
        public string $exchangeNumber,
        public string $originalSaleId,
        public string $originalSaleNumber,
        public string $terminalId,
        public string $cashierId,
        public ?string $customerId,
        public string $currency,
        public string $reason,
        public int $returnedLineCount,
        public int $replacementLineCount,
    ) {}

    public static function now(
        string $exchangeId,
        string $exchangeNumber,
        string $originalSaleId,
        string $originalSaleNumber,
        string $terminalId,
        string $cashierId,
        ?string $customerId,
        string $currency,
        string $reason,
        int $returnedLineCount,
        int $replacementLineCount,
    ): self {
        return new self(
            eventId: self::generateUuid(),
            occurredAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
            exchangeId: $exchangeId,
            exchangeNumber: $exchangeNumber,
            originalSaleId: $originalSaleId,
            originalSaleNumber: $originalSaleNumber,
            terminalId: $terminalId,
            cashierId: $cashierId,
            customerId: $customerId,
            currency: $currency,
            reason: $reason,
            returnedLineCount: $returnedLineCount,
            replacementLineCount: $replacementLineCount,
        );
    }

    public function eventId(): string
    {
        return $this->eventId;
    }

    public function eventName(): string
    {
        return 'pos.exchange.initiated';
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
            'original_sale_id' => $this->originalSaleId,
            'original_sale_number' => $this->originalSaleNumber,
            'terminal_id' => $this->terminalId,
            'cashier_id' => $this->cashierId,
            'customer_id' => $this->customerId,
            'currency' => $this->currency,
            'reason' => $this->reason,
            'returned_line_count' => $this->returnedLineCount,
            'replacement_line_count' => $this->replacementLineCount,
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
