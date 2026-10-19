<?php

declare(strict_types=1);

namespace Modules\POS\Shared\Domain\ValueObjects;

use InvalidArgumentException;

/**
 * Immutable quantity value with 4-decimal-place BCMath precision.
 *
 * Covers both integer quantities (1, 2, 10) and fractional quantities
 * (1.500 kg, 0.250 m). Stored as a decimal string.
 * Positivity is NOT enforced here — domain rules decide when a negative
 * quantity is illegal.
 */
final readonly class Quantity
{
    private const SCALE = 4;

    public function __construct(public string $value)
    {
        if (! is_numeric($this->value)) {
            throw new InvalidArgumentException(
                "Quantity value must be numeric, got: \"{$this->value}\".",
            );
        }
    }

    public static function of(string|int|float $value): self
    {
        if (is_string($value) && ! is_numeric($value)) {
            throw new InvalidArgumentException(
                "Quantity value must be numeric, got: \"{$value}\".",
            );
        }

        return new self(bcadd((string) $value, '0', self::SCALE));
    }

    public static function zero(): self
    {
        return new self('0.0000');
    }

    public static function one(): self
    {
        return new self('1.0000');
    }

    public function add(Quantity $other): self
    {
        return new self(bcadd($this->value, $other->value, self::SCALE));
    }

    public function subtract(Quantity $other): self
    {
        return new self(bcsub($this->value, $other->value, self::SCALE));
    }

    public function multiply(string|int|float $factor): self
    {
        return new self(bcmul($this->value, (string) $factor, self::SCALE));
    }

    public function divide(string|int|float $divisor): self
    {
        if (bccomp((string) $divisor, '0', self::SCALE) === 0) {
            throw new InvalidArgumentException('Cannot divide a Quantity by zero.');
        }

        return new self(bcdiv($this->value, (string) $divisor, self::SCALE));
    }

    public function absolute(): self
    {
        return $this->isNegative()
            ? new self(bcsub('0', $this->value, self::SCALE))
            : $this;
    }

    public function isZero(): bool
    {
        return bccomp($this->value, '0', self::SCALE) === 0;
    }

    public function isPositive(): bool
    {
        return bccomp($this->value, '0', self::SCALE) > 0;
    }

    public function isNegative(): bool
    {
        return bccomp($this->value, '0', self::SCALE) < 0;
    }

    public function equals(Quantity $other): bool
    {
        return bccomp($this->value, $other->value, self::SCALE) === 0;
    }

    public function isGreaterThan(Quantity $other): bool
    {
        return bccomp($this->value, $other->value, self::SCALE) > 0;
    }

    public function isLessThan(Quantity $other): bool
    {
        return bccomp($this->value, $other->value, self::SCALE) < 0;
    }

    public function isGreaterThanOrEqual(Quantity $other): bool
    {
        return bccomp($this->value, $other->value, self::SCALE) >= 0;
    }

    public function toFloat(): float
    {
        return (float) $this->value;
    }

    public function toInt(): int
    {
        return (int) $this->value;
    }

    public function __toString(): string
    {
        return $this->value;
    }
}
