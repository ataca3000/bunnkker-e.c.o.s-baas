<?php

declare(strict_types=1);

namespace Modules\POS\Shift\Domain\ValueObjects;

use InvalidArgumentException;

/**
 * Identifies a shift with a sequential, human-readable number scoped to a terminal.
 *
 * The first shift on a terminal is 1. Numbers are assigned by the repository
 * and enforced unique-per-terminal at the database level.
 */
final readonly class ShiftNumber
{
    public function __construct(public int $value)
    {
        if ($value < 1) {
            throw new InvalidArgumentException(
                "Shift number must be a positive integer, got: {$value}.",
            );
        }
    }

    public static function of(int $value): self
    {
        return new self($value);
    }

    public function next(): self
    {
        return new self($this->value + 1);
    }

    public function equals(self $other): bool
    {
        return $this->value === $other->value;
    }

    public function __toString(): string
    {
        return (string) $this->value;
    }
}
