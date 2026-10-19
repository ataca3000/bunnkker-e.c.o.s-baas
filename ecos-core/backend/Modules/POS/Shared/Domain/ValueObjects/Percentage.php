<?php

declare(strict_types=1);

namespace Modules\POS\Shared\Domain\ValueObjects;

use InvalidArgumentException;

/**
 * Immutable percentage value in the range [0, 100].
 *
 * Stored as a string with 4 decimal places, e.g. "14.0000" for 14%.
 * Use applyTo() to compute the monetary effect of the percentage.
 */
final readonly class Percentage
{
    private const SCALE = 4;

    public function __construct(public string $value)
    {
        if (! is_numeric($this->value)) {
            throw new InvalidArgumentException(
                "Percentage value must be numeric, got: \"{$this->value}\".",
            );
        }
        if (bccomp($this->value, '0', self::SCALE) < 0) {
            throw new InvalidArgumentException(
                "Percentage cannot be negative, got: \"{$this->value}\".",
            );
        }
        if (bccomp($this->value, '100', self::SCALE) > 0) {
            throw new InvalidArgumentException(
                "Percentage cannot exceed 100, got: \"{$this->value}\".",
            );
        }
    }

    /** Create from a percentage value, e.g. Percentage::of('14') for 14%. */
    public static function of(string|int|float $value): self
    {
        if (is_string($value) && ! is_numeric($value)) {
            throw new InvalidArgumentException(
                "Percentage value must be numeric, got: \"{$value}\".",
            );
        }

        return new self(bcadd((string) $value, '0', self::SCALE));
    }

    /** Create from a decimal fraction, e.g. Percentage::ofFraction('0.14') → 14%. */
    public static function ofFraction(string|float $fraction): self
    {
        return new self(bcmul((string) $fraction, '100', self::SCALE));
    }

    public static function zero(): self
    {
        return new self('0.0000');
    }

    public static function oneHundred(): self
    {
        return new self('100.0000');
    }

    /** Apply this percentage to a Money amount (e.g. 14% of 100 EGP = 14.00 EGP). */
    public function applyTo(Money $money, int $scale = 2): Money
    {
        $factor = bcdiv($this->value, '100', self::SCALE + 2);

        return $money->multiply($factor, $scale);
    }

    /** Returns the decimal fraction string (e.g. "0.1400" for 14%). */
    public function asFraction(): string
    {
        return bcdiv($this->value, '100', self::SCALE);
    }

    public function add(Percentage $other): self
    {
        return new self(bcadd($this->value, $other->value, self::SCALE));
    }

    public function subtract(Percentage $other): self
    {
        return new self(bcsub($this->value, $other->value, self::SCALE));
    }

    public function isZero(): bool
    {
        return bccomp($this->value, '0', self::SCALE) === 0;
    }

    public function equals(Percentage $other): bool
    {
        return bccomp($this->value, $other->value, self::SCALE) === 0;
    }

    public function isGreaterThan(Percentage $other): bool
    {
        return bccomp($this->value, $other->value, self::SCALE) > 0;
    }

    public function __toString(): string
    {
        return $this->value.'%';
    }
}
