<?php

declare(strict_types=1);

namespace Modules\POS\Discount\Domain\ValueObjects;

use InvalidArgumentException;
use Modules\POS\Shared\Domain\Enums\DiscountType;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Percentage;

/**
 * Immutable value object representing either a percentage discount or a fixed-amount discount.
 *
 * Delegates all monetary computation to DiscountType::computeAmount() which uses BCMath
 * internally — no PHP float arithmetic is performed.
 */
final readonly class DiscountValue
{
    private function __construct(
        public DiscountType $type,
        public string $rawValue,  // percentage: "10.0000"; fixed: "50.00"
        public ?string $currency,  // null for percentage; ISO 4217 for fixed
    ) {}

    public static function percentage(Percentage $percentage): self
    {
        return new self(DiscountType::Percentage, $percentage->value, null);
    }

    public static function fixed(Money $amount): self
    {
        if (! $amount->isPositive()) {
            throw new InvalidArgumentException('Fixed discount amount must be positive.');
        }

        return new self(DiscountType::FixedAmount, $amount->amount, $amount->currency);
    }

    /**
     * Compute the monetary reduction this discount applies to a base amount.
     * Delegates to DiscountType::computeAmount() for BCMath-safe arithmetic.
     */
    public function apply(Money $baseAmount): Money
    {
        return $this->type->computeAmount($baseAmount, $this->rawValue);
    }

    public function asPercentage(): ?Percentage
    {
        if ($this->type !== DiscountType::Percentage) {
            return null;
        }

        return Percentage::of($this->rawValue);
    }

    public function asFixedAmount(): ?Money
    {
        if ($this->type !== DiscountType::FixedAmount || $this->currency === null) {
            return null;
        }

        return Money::of($this->rawValue, $this->currency);
    }

    public function isPercentage(): bool
    {
        return $this->type === DiscountType::Percentage;
    }

    public function isFixed(): bool
    {
        return $this->type === DiscountType::FixedAmount;
    }

    public function toArray(): array
    {
        return [
            'type' => $this->type->value,
            'raw_value' => $this->rawValue,
            'currency' => $this->currency,
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            type: DiscountType::from($data['type']),
            rawValue: $data['raw_value'],
            currency: $data['currency'] ?? null,
        );
    }
}
