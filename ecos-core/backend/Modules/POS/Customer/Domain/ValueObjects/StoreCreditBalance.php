<?php

declare(strict_types=1);

namespace Modules\POS\Customer\Domain\ValueObjects;

use InvalidArgumentException;
use Modules\POS\Shared\Domain\ValueObjects\Money;

final readonly class StoreCreditBalance
{
    public function __construct(
        public string $customerId,
        public Money $available,
        public Money $reserved,
    ) {}

    public static function of(string $customerId, Money $available, Money $reserved): self
    {
        if (trim($customerId) === '') {
            throw new InvalidArgumentException('Customer ID cannot be empty.');
        }

        if ($available->currency !== $reserved->currency) {
            throw new InvalidArgumentException(
                'Available and reserved store credit must use the same currency.',
            );
        }

        return new self($customerId, $available, $reserved);
    }

    public static function zero(string $customerId, string $currency): self
    {
        if (trim($customerId) === '') {
            throw new InvalidArgumentException('Customer ID cannot be empty.');
        }

        return new self($customerId, Money::zero($currency), Money::zero($currency));
    }

    public function effectiveAvailable(): Money
    {
        return $this->available->subtract($this->reserved);
    }

    public function hasCredit(): bool
    {
        return $this->effectiveAvailable()->isPositive();
    }

    public function canApply(Money $amount): bool
    {
        return $amount->isPositive() && $this->effectiveAvailable()->isGreaterThanOrEqual($amount);
    }

    public function toArray(): array
    {
        return [
            'customer_id' => $this->customerId,
            'available' => $this->available->toArray(),
            'reserved' => $this->reserved->toArray(),
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            customerId: $data['customer_id'],
            available: Money::fromArray($data['available']),
            reserved: Money::fromArray($data['reserved']),
        );
    }
}
