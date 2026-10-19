<?php

declare(strict_types=1);

namespace Modules\POS\Cart\Domain\ValueObjects;

use InvalidArgumentException;

/**
 * Human-readable identifier printed on the customer's receipt.
 *
 * Format is left to the application layer (e.g. "RCP-2026-000123").
 * This VO only enforces that the value is non-empty and within bounds.
 */
final readonly class ReceiptNumber
{
    public function __construct(public string $value)
    {
        if (trim($value) === '') {
            throw new InvalidArgumentException('Receipt number cannot be empty.');
        }
        if (strlen($value) > 100) {
            throw new InvalidArgumentException(
                'Receipt number cannot exceed 100 characters, got: '.strlen($value).'.',
            );
        }
    }

    public static function of(string $value): self
    {
        return new self(trim($value));
    }

    public function equals(self $other): bool
    {
        return $this->value === $other->value;
    }

    public function __toString(): string
    {
        return $this->value;
    }
}
