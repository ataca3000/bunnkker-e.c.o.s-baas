<?php

declare(strict_types=1);

namespace Modules\POS\Pricing\Domain\Events;

use DateTimeImmutable;
use DateTimeZone;
use Modules\POS\Pricing\Domain\Enums\PriceSource;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;
use Modules\POS\Shared\Domain\ValueObjects\Money;

final readonly class PriceResolved implements DomainEvent
{
    public function __construct(
        private string $eventId,
        private DateTimeImmutable $occurredAt,
        public string $productId,
        public string $unitPriceAmount,
        public string $currency,
        public string $source,
        public string $resolvedAt,
    ) {}

    public static function now(
        string $productId,
        Money $unitPrice,
        PriceSource $source,
        string $resolvedAt,
    ): self {
        return new self(
            eventId: self::generateUuid(),
            occurredAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
            productId: $productId,
            unitPriceAmount: $unitPrice->amount,
            currency: $unitPrice->currency,
            source: $source->value,
            resolvedAt: $resolvedAt,
        );
    }

    public function eventId(): string
    {
        return $this->eventId;
    }

    public function eventName(): string
    {
        return 'pos.pricing.price_resolved';
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
            'product_id' => $this->productId,
            'unit_price_amount' => $this->unitPriceAmount,
            'currency' => $this->currency,
            'source' => $this->source,
            'resolved_at' => $this->resolvedAt,
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
