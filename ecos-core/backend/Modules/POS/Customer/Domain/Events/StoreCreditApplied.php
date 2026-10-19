<?php

declare(strict_types=1);

namespace Modules\POS\Customer\Domain\Events;

use DateTimeImmutable;
use DateTimeZone;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;
use Modules\POS\Shared\Domain\ValueObjects\Money;

final readonly class StoreCreditApplied implements DomainEvent
{
    public function __construct(
        private string $eventId,
        private DateTimeImmutable $occurredAt,
        public string $customerId,
        public string $amountAppliedAmount,
        public string $amountAppliedCurrency,
        public string $transactionRef,
    ) {}

    public static function now(
        string $customerId,
        Money $amountApplied,
        string $transactionRef,
    ): self {
        return new self(
            eventId: self::generateUuid(),
            occurredAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
            customerId: $customerId,
            amountAppliedAmount: $amountApplied->amount,
            amountAppliedCurrency: $amountApplied->currency,
            transactionRef: $transactionRef,
        );
    }

    public function eventId(): string
    {
        return $this->eventId;
    }

    public function eventName(): string
    {
        return 'pos.customer.store_credit_applied';
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
            'customer_id' => $this->customerId,
            'amount_applied_amount' => $this->amountAppliedAmount,
            'amount_applied_currency' => $this->amountAppliedCurrency,
            'transaction_ref' => $this->transactionRef,
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
