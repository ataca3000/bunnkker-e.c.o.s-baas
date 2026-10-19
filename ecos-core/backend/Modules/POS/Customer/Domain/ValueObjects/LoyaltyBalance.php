<?php

declare(strict_types=1);

namespace Modules\POS\Customer\Domain\ValueObjects;

use InvalidArgumentException;
use Modules\POS\Shared\Domain\ValueObjects\Money;

final readonly class LoyaltyBalance
{
    public function __construct(
        public string $customerId,
        public int $points,
        public Money $monetaryValue,
    ) {}

    public static function of(string $customerId, int $points, Money $monetaryValue): self
    {
        if (trim($customerId) === '') {
            throw new InvalidArgumentException('Customer ID cannot be empty.');
        }

        if ($points < 0) {
            throw new InvalidArgumentException('Loyalty points cannot be negative.');
        }

        return new self($customerId, $points, $monetaryValue);
    }

    public static function zero(string $customerId, string $currency): self
    {
        if (trim($customerId) === '') {
            throw new InvalidArgumentException('Customer ID cannot be empty.');
        }

        return new self($customerId, 0, Money::zero($currency));
    }

    public function hasPoints(): bool
    {
        return $this->points > 0;
    }

    public function canRedeem(int $pointsRequested): bool
    {
        return $pointsRequested > 0 && $this->points >= $pointsRequested;
    }

    public function toArray(): array
    {
        return [
            'customer_id' => $this->customerId,
            'points' => $this->points,
            'monetary_value' => $this->monetaryValue->toArray(),
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            customerId: $data['customer_id'],
            points: (int) $data['points'],
            monetaryValue: Money::fromArray($data['monetary_value']),
        );
    }
}
