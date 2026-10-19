<?php

declare(strict_types=1);

namespace Modules\POS\Discount\Domain\ValueObjects;

use Modules\POS\Discount\Domain\Exceptions\InvalidDiscountException;
use Modules\POS\Shared\Domain\Enums\DiscountType;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Percentage;

/**
 * Immutable value object expressing the upper bound of an allowed discount.
 *
 * A limit applies to one or both discount types. If the relevant bound is null,
 * that discount type is unlimited in this dimension.
 *
 * Fixed-amount limits must use the same currency as the store's operating currency.
 */
final readonly class DiscountLimit
{
    public function __construct(
        public ?Percentage $maxPercentage,
        public ?Money $maxFixedAmount,
    ) {}

    public static function unlimited(): self
    {
        return new self(null, null);
    }

    public static function percentageOnly(Percentage $max): self
    {
        return new self($max, null);
    }

    public static function fixedOnly(Money $max): self
    {
        return new self(null, $max);
    }

    public static function both(Percentage $maxPct, Money $maxFixed): self
    {
        return new self($maxPct, $maxFixed);
    }

    /**
     * Throw if the given DiscountValue exceeds this limit.
     * Only the dimension matching the value's type is checked.
     */
    public function validate(DiscountValue $value): void
    {
        match ($value->type) {
            DiscountType::Percentage => $this->validatePercentage($value->asPercentage()),
            DiscountType::FixedAmount => $this->validateFixed($value->asFixedAmount()),
        };
    }

    public function isWithin(DiscountValue $value): bool
    {
        try {
            $this->validate($value);

            return true;
        } catch (InvalidDiscountException) {
            return false;
        }
    }

    public function toArray(): array
    {
        return [
            'max_percentage' => $this->maxPercentage?->value,
            'max_fixed_amount' => $this->maxFixedAmount?->toArray(),
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            maxPercentage: isset($data['max_percentage'])
                ? Percentage::of($data['max_percentage'])
                : null,
            maxFixedAmount: isset($data['max_fixed_amount'])
                ? Money::fromArray($data['max_fixed_amount'])
                : null,
        );
    }

    private function validatePercentage(?Percentage $pct): void
    {
        if ($pct === null || $this->maxPercentage === null) {
            return;
        }
        if ($pct->isGreaterThan($this->maxPercentage)) {
            throw InvalidDiscountException::exceedsPercentageLimit($pct->value, $this->maxPercentage->value);
        }
    }

    private function validateFixed(?Money $amount): void
    {
        if ($amount === null || $this->maxFixedAmount === null) {
            return;
        }
        if ($amount->isGreaterThan($this->maxFixedAmount)) {
            throw InvalidDiscountException::exceedsFixedAmountLimit($amount->amount, $this->maxFixedAmount->amount);
        }
    }
}
