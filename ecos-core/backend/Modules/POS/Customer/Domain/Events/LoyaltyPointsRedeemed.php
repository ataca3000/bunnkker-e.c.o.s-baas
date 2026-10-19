<?php

declare(strict_types=1);

namespace Modules\POS\Customer\Domain\Events;

use DateTimeImmutable;
use DateTimeZone;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;
use Modules\POS\Shared\Domain\ValueObjects\Money;

final readonly class LoyaltyPointsRedeemed implements DomainEvent
{
    public function __construct(
        private string $eventId,
        private DateTimeImmutable $occurredAt,
        public string $customerId,
        public int $pointsRedeemed,
        public string $monetaryValueAmount,
        public string $monetaryValueCurrency,
        public string $transactionRef,
    ) {}

    public static function now(
        string $customerId,
        int $pointsRedeemed,
        Money $monetaryValue,
        string $transactionRef,
    ): self {
        return new self(
            eventId: self::generateUuid(),
            occurredAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
            customerId: $customerId,
            pointsRedeemed: $pointsRedeemed,
            monetaryValueAmount: $monetaryValue->amount,
            monetaryValueCurrency: $monetaryValue->currency,
            transactionRef: $transactionRef,
        );
    }

    public function eventId(): string
    {
        return $this->eventId;
    }

    public function eventName(): string
    {
        return 'pos.customer.loyalty_points_redeemed';
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
            'points_redeemed' => $this->pointsRedeemed,
            'monetary_value_amount' => $this->monetaryValueAmount,
            'monetary_value_currency' => $this->monetaryValueCurrency,
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
