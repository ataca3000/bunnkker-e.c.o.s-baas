<?php

declare(strict_types=1);

namespace Modules\POS\Customer\Domain\Events;

use DateTimeImmutable;
use DateTimeZone;
use Modules\POS\Customer\Domain\Enums\CustomerLookupType;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;

final readonly class CustomerIdentified implements DomainEvent
{
    public function __construct(
        private string $eventId,
        private DateTimeImmutable $occurredAt,
        public string $customerId,
        public string $customerCode,
        public string $name,
        public bool $hasEmail,
        public bool $hasPhone,
        public CustomerLookupType $lookupType,
    ) {}

    public static function now(
        string $customerId,
        string $customerCode,
        string $name,
        bool $hasEmail,
        bool $hasPhone,
        CustomerLookupType $lookupType,
    ): self {
        return new self(
            eventId: self::generateUuid(),
            occurredAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
            customerId: $customerId,
            customerCode: $customerCode,
            name: $name,
            hasEmail: $hasEmail,
            hasPhone: $hasPhone,
            lookupType: $lookupType,
        );
    }

    public function eventId(): string
    {
        return $this->eventId;
    }

    public function eventName(): string
    {
        return 'pos.customer.customer_identified';
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
            'customer_code' => $this->customerCode,
            'name' => $this->name,
            'has_email' => $this->hasEmail,
            'has_phone' => $this->hasPhone,
            'lookup_type' => $this->lookupType->value,
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
