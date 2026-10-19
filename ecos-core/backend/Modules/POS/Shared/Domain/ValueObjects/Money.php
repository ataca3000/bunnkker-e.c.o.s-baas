<?php

declare(strict_types=1);

namespace Modules\POS\Shared\Domain\ValueObjects;

use InvalidArgumentException;
use Modules\POS\Shared\Domain\Exceptions\InvalidMoneyOperationException;

/**
 * Immutable monetary value with BCMath precision.
 *
 * Amounts are stored as 2-decimal-place strings (e.g. "10.50").
 * All arithmetic preserves 2 decimal places unless an explicit scale is passed.
 * Currency codes follow ISO 4217 (e.g. "EGP", "USD").
 */
final readonly class Money
{
    public function __construct(
        public string $amount,
        public string $currency,
    ) {
        if (! is_numeric($this->amount)) {
            throw new InvalidArgumentException(
                "Money amount must be numeric, got: \"{$this->amount}\".",
            );
        }
        if (trim($this->currency) === '') {
            throw new InvalidArgumentException('Currency code cannot be empty.');
        }
    }

    public static function of(string|int|float $amount, string $currency): self
    {
        return new self(
            amount: bcadd((string) $amount, '0', 2),
            currency: strtoupper(trim($currency)),
        );
    }

    public static function zero(string $currency): self
    {
        return new self('0.00', strtoupper(trim($currency)));
    }

    /** @param array{amount: string, currency: string} $data */
    public static function fromArray(array $data): self
    {
        return self::of($data['amount'], $data['currency']);
    }

    public function add(Money $other): self
    {
        $this->guardSameCurrency($other);

        return new self(bcadd($this->amount, $other->amount, 2), $this->currency);
    }

    public function subtract(Money $other): self
    {
        $this->guardSameCurrency($other);

        return new self(bcsub($this->amount, $other->amount, 2), $this->currency);
    }

    /** Multiply by a scalar factor (e.g. a tax rate as '0.14', a quantity as '3'). */
    public function multiply(string|int|float $factor, int $scale = 2): self
    {
        return new self(bcmul($this->amount, (string) $factor, $scale), $this->currency);
    }

    /** Divide by a scalar divisor (e.g. split a total into per-unit price). */
    public function divide(string|int|float $divisor, int $scale = 2): self
    {
        if (bccomp((string) $divisor, '0', 10) === 0) {
            throw InvalidMoneyOperationException::divisionByZero();
        }

        return new self(bcdiv($this->amount, (string) $divisor, $scale), $this->currency);
    }

    /**
     * Fairly allocate this amount into N parts.
     * The first part absorbs any remainder from rounding.
     *
     * @return Money[]
     */
    public function allocate(int $parts): array
    {
        if ($parts <= 0) {
            throw InvalidMoneyOperationException::invalidParts($parts);
        }
        $each = bcdiv($this->amount, (string) $parts, 2);
        $allocated = array_fill(0, $parts, new self($each, $this->currency));
        $remainder = bcsub($this->amount, bcmul($each, (string) $parts, 2), 2);
        if (bccomp($remainder, '0', 2) !== 0) {
            $allocated[0] = new self(bcadd($each, $remainder, 2), $this->currency);
        }

        return $allocated;
    }

    public function absolute(): self
    {
        return $this->isNegative()
            ? new self(bcsub('0', $this->amount, 2), $this->currency)
            : $this;
    }

    public function negate(): self
    {
        return new self(bcsub('0', $this->amount, 2), $this->currency);
    }

    public function isZero(): bool
    {
        return bccomp($this->amount, '0', 2) === 0;
    }

    public function isPositive(): bool
    {
        return bccomp($this->amount, '0', 2) > 0;
    }

    public function isNegative(): bool
    {
        return bccomp($this->amount, '0', 2) < 0;
    }

    public function equals(Money $other): bool
    {
        return $this->currency === $other->currency
            && bccomp($this->amount, $other->amount, 2) === 0;
    }

    public function isGreaterThan(Money $other): bool
    {
        $this->guardSameCurrency($other);

        return bccomp($this->amount, $other->amount, 2) > 0;
    }

    public function isLessThan(Money $other): bool
    {
        $this->guardSameCurrency($other);

        return bccomp($this->amount, $other->amount, 2) < 0;
    }

    public function isGreaterThanOrEqual(Money $other): bool
    {
        $this->guardSameCurrency($other);

        return bccomp($this->amount, $other->amount, 2) >= 0;
    }

    public function isLessThanOrEqual(Money $other): bool
    {
        $this->guardSameCurrency($other);

        return bccomp($this->amount, $other->amount, 2) <= 0;
    }

    public function toFloat(): float
    {
        return (float) $this->amount;
    }

    /** @return array{amount: string, currency: string} */
    public function toArray(): array
    {
        return ['amount' => $this->amount, 'currency' => $this->currency];
    }

    public function __toString(): string
    {
        return "{$this->amount} {$this->currency}";
    }

    private function guardSameCurrency(Money $other): void
    {
        if ($this->currency !== $other->currency) {
            throw InvalidMoneyOperationException::currencyMismatch($this->currency, $other->currency);
        }
    }
}
